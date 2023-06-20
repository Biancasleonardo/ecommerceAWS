import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as ssm from "aws-cdk-lib/aws-ssm"; //guarda parametros dentro do aws

// É necessário usar a tabela do produtos, pois será feito uma consulta na tabela de produtos
interface OrdersAppStackProps extends cdk.StackProps {
    productDdb: dynamodb.Table
}

export class OrdersAppStack extends cdk.Stack {

    readonly ordersHandler: lambdaNodeJS.NodejsFunction

    constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
        super(scope, id, props)

        const ordersDdb = new dynamodb.Table(this, 'OrdersDdb', {
            tableName: 'orders',
            removalPolicy: cdk.RemovalPolicy.DESTROY, // padrão é manter a tabela quando a stack é excluida
            partitionKey: {
                name: 'pk', //define pk como atributo primario
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {  //adiciona uma chave composta
                name: "sk",
                type: dynamodb.AttributeType.STRING 
            },
            billingMode: dynamodb.BillingMode.PROVISIONED, //modo como é feita a cobrança
            readCapacity: 1, //qtd de req de leitura a tabela pode receber por segundo
            writeCapacity: 1
        })

        // Orders Layer
        const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn')
        const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn)
       
        // Orders API Layer
        const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn')
        const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn)

        // Products Layer
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, "OrdersFunction", {
            functionName: 'OrdersFunction',
            entry: 'lambda/orders/ordersFunction.ts',
            handler: 'handler',
            memorySize: 128, // quantidade de memória que a função vai ter para executar
            timeout: cdk.Duration.seconds(2), // tempo máximo para executar a função
            bundling: {
                minify: true, //minificar o código para melhorar a execução
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: props.productDdb.tableName,
                ORDERS_DDB: ordersDdb.tableName,
            },
            layers: [ordersLayer, productsLayer, ordersApiLayer],
            tracing: lambda.Tracing.ACTIVE, //ativa o rastreamento da função para ver o tempo de excução de forma mais detalhada usando o x-ray
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0, // habilita logs do insight
        })

        ordersDdb.grantWriteData(this.ordersHandler)
        props.productDdb.grantReadData(this.ordersHandler) // Necessário para consultar a tabela de produtos, permite apenas o acesso de leitura

    }
}