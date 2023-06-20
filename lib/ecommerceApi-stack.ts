import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"

import { Construct } from 'constructs'

// ECommerceApiStackProps vai receber todas as propriedades de cdk.StackProps e adicionar novas propriedades, e devido a isso ela vai passar a ser obrigatoria no construtor
interface ECommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJS.NodejsFunction
    productsAdminHandler: lambdaNodeJS.NodejsFunction
    ordersHandler: lambdaNodeJS.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack {

    // formato padrão cdk.Stack
    constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
        super(scope, id, props)

        // criar log no aws
        const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs")

        const api = new apigateway.RestApi(this, "ECommerceApi", {
            restApiName: "ECommerceApi",
            cloudWatchRole: true,
            // adiciona log no aws
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                // adiciona opções do log
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true,
                    ip: true, //informação sensível
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    caller: true,
                    user: true //informação sensível
                })
            }
        })

        this.createProductsService(props, api)

        this.createOrdersService(props, api)
    }

    private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi){
        const orderIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        // resource - /orders
        const ordersResource = api.root.addResource('orders')

        // get /orders
        // get /orders?email=***
        // get /orders?email=****&orderId=***
        ordersResource.addMethod('GET', orderIntegration)

        // delete /orders?email=****&orderId=***
        // Valida os parametros
        const orderDeletionValidator = new apigateway.RequestValidator(this, 'OrderDeletionValidator', {
            restApi: api,
            requestValidatorName: "orderDeletionValidator",
            validateRequestParameters: true,
        })

        ordersResource.addMethod('DELETE', orderIntegration, {
            requestParameters: {
                'method.request.querystring.email': true, //obriga a ter o atributo
                'method.request.querystring.orderId': true, //obriga a ter o atributo
            },
            requestValidator: orderDeletionValidator
        })

        // post /orders
        ordersResource.addMethod('POST', orderIntegration)

    }

    private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

        // GET /products
        // api.root.addResource("products") representa "/products"
        const productsResource = api.root.addResource('products')
        // redireciona a chamada quando for get para productsFetchIntegration
        productsResource.addMethod('GET', productsFetchIntegration)

        // GET /products/{id} - adiciona um novo parametro de busca
        const productIdResource = productsResource.addResource('{id}')
        productIdResource.addMethod('GET', productsFetchIntegration)


        const productAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        // POST /products
        productsResource.addMethod('POST', productAdminIntegration)

        // PUT /products/{id}
        productIdResource.addMethod('PUT', productAdminIntegration)

        // DELETE /products/{id}
        productIdResource.addMethod('DELETE', productAdminIntegration)
    }
}