import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'


export class EventsDdbStack extends cdk.Stack {
    readonly table: dynamodb.Table

    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope, id, props)

        this.table = new dynamodb.Table(this, "EventsDdb", {
            tableName: "events",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {  //adiciona uma chave composta
                name: "sk",
                type: dynamodb.AttributeType.STRING 
            },
            timeToLiveAttribute: "ttl", //configura um tempo para que o item seja apagado automaticamente
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })
    }
}