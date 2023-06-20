import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "./layers/productsLayer/nodejs/productRepository";
import { DynamoDB, Lambda } from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { ProductEvent, ProductEventType } from "/opt/nodejs/productEventsLayer";

AWSXRay.captureAWS(require('aws-sdk')) // da permissão ao XRAY capturar e medir o tempo gasto nas operações do sdk

const productsDdb = process.env.PRODUCTS_DDB!
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME!

const ddbCliente = new DynamoDB.DocumentClient()
const lambdaClient = new Lambda()

const productRepository = new ProductRepository(ddbCliente, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const method = event.httpMethod
    const lambdaRequestId = context.awsRequestId //contexto da execução da função lambda
    const apiRequestId = event.requestContext.requestId //contexto da requisição que entrou pelo APIGateway

    console.log(`API Gateway RequestId: ${apiRequestId} - lambda RequestId: ${lambdaRequestId}`)

    if (event.resource === '/products') {
        if (method === 'POST') {
            console.log('POST /products')

            const product = JSON.parse(event.body!) as Product

            const productCreated = await productRepository.createProduct(product)

            // cria o evento
            const response = await sendProductEvent(productCreated, ProductEventType.CREATED, 'biancasleonardo@gmail.com', lambdaRequestId)

            console.log('responseSendProductEvent - create', response)

            return {
                statusCode: 201,
                body: JSON.stringify(productCreated)
            }
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string

        if (method === 'PUT') {
            console.log(`PUT /products/${productId}`)

            const product = JSON.parse(event.body!)

            try {
                const productUpdated = await productRepository.updateProduct(productId, product)

                // cria o evento
                const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'biancasleonardo@gmail.com', lambdaRequestId)

                console.log('responseSendProductEvent - update', response)

                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdated)
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: 'Product nout found'
                }
            }


        } else if (method === 'DELETE') {
            console.log(`DELETE /products/${productId}`)

            try {
                const product = await productRepository.deleteProduct(productId)

                // cria o evento
                const response = await sendProductEvent(product, ProductEventType.DELETED, 'biancasleonardo@gmail.com', lambdaRequestId)

                console.log('responseSendProductEvent - delete', response)

                return {
                    statusCode: 200,
                    body: JSON.stringify(product)
                }
            } catch (error) {
                console.log((<Error>error).message)
                return {
                    statusCode: 404,
                    body: (<Error>error).message
                }
            }

        }
    }
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: `bad request`
        })
    }
}

async function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    const event: ProductEvent = {
        email: email,
        eventType: eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    }

    return lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: "RequestResponse" // indica que a invocação é sincrona, caso queira rodar de forma assincrona, basta alterer para "Event"
    }).promise()
}
