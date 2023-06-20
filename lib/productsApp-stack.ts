import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as ssm from "aws-cdk-lib/aws-ssm"; //guarda parametros dentro do aws

interface ProductsAppStackProps extends cdk.StackProps{
    eventsDdb: dynamodb.Table
}
export class ProductAppStack extends cdk.Stack {

    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
    readonly productsAdminHandler: lambdaNodeJS.NodejsFunction

    readonly productsDdb: dynamodb.Table

    constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
        super(scope, id, props)

        // cria a tabela
        this.productsDdb = new dynamodb.Table(this, 'ProductsDdb', {
            tableName: 'products',
            removalPolicy: cdk.RemovalPolicy.DESTROY, // padrão é manter a tabela quando a stack é excluida
            partitionKey: {
                name: 'id', //define id como atributo primario
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED, //modo como é feita a cobrança
            readCapacity: 1, //qtd de req de leitura a tabela pode receber por segundo
            writeCapacity: 1
        })

        // Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        // Product Events Layer
        const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductEventsLayerVersionArn')
        const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductEventsLayerVersionArn', productEventsLayerArn)

        const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'productsEventsFunction', {
            functionName: 'productsEventsFunction',
            entry: 'lambda/products/productEventsFunction.ts',
            handler: 'handler',
            memorySize: 128, // quantidade de memória que a função vai ter para executar
            timeout: cdk.Duration.seconds(2), // tempo máximo para executar a função
            bundling: {
                minify: true, //minificar o código para melhorar a execução
                sourceMap: false
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            },
            layers: [productEventsLayer],
            tracing: lambda.Tracing.ACTIVE, //ativa o rastreamento da função para ver o tempo de excução de forma mais detalhada usando o x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0, // habilita logs do insight
        })
        props.eventsDdb.grantWriteData(productEventsHandler)


        // cria a função lambda de pesquisa de produtos
        this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, 'productsFetchFunction', {
            functionName: 'productsFetchFunction',
            entry: 'lambda/products/productsFetchFunction.ts',
            handler: 'handler',
            memorySize: 128, // quantidade de memória que a função vai ter para executar
            timeout: cdk.Duration.seconds(5), // tempo máximo para executar a função
            bundling: {
                minify: true, //minificar o código para melhorar a execução
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName
            },
            layers: [productsLayer],
            tracing: lambda.Tracing.ACTIVE, //ativa o rastreamento da função para ver o tempo de excução de forma mais detalhada usando o x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0, // habilita logs do insight
        })

        // Da a permição a productsFetchHandler de somente leitura
        this.productsDdb.grantReadData(this.productsFetchHandler)

        // cria a função lambda de criação e alteração de produtos
        this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, 'productsAdminFunction', {
            functionName: 'productsAdminFunction',
            entry: 'lambda/products/productsAdminFunction.ts',
            handler: 'handler',
            memorySize: 128, // quantidade de memória que a função vai ter para executar
            timeout: cdk.Duration.seconds(5), // tempo máximo para executar a função
            bundling: {
                minify: true, //minificar o código para melhorar a execução
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName,
                PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName //invoca a função de evento do produto
            },
            layers: [productsLayer, productEventsLayer],
            tracing: lambda.Tracing.ACTIVE, //ativa o rastreamento da função para ver o tempo de excução de forma mais detalhada usando o x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0, // habilita logs do insight
        })

        // Da a permição a productsAdminHandler de somente escrita
        this.productsDdb.grantWriteData(this.productsAdminHandler)
        productEventsHandler.grantInvoke(this.productsAdminHandler) // concede permissão para invocar a função de evento
    }
}