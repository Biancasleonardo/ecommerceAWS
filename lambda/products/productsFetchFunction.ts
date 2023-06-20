import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "./layers/productsLayer/nodejs/productRepository";
import { DynamoDB } from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk')) // da permissão ao XRAY capturar e medir o tempo gasto nas operações do sdk

const productsDdb = process.env.PRODUCTS_DDB!
const ddbCliente = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbCliente, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const method = event.httpMethod
    const lambdaRequestId = context.awsRequestId //contexto da execução da função lambda
    const apiRequestId = event.requestContext.requestId //contexto da requisição que entrou pelo APIGateway

    console.log(`API Gateway RequestId: ${apiRequestId} - lambda RequestId: ${lambdaRequestId}`)

    if (event.resource === '/products') {
        if (method === 'GET') {
            console.log('GET /products')

            const products = await productRepository.getAllProducts()

            return {
                statusCode: 200,
                body: JSON.stringify(products)
            }
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string
        console.log(`GET /products/${productId}`)

        try {
            const product = await productRepository.getProductById(productId)

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

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Bad request'
        })
    }
}