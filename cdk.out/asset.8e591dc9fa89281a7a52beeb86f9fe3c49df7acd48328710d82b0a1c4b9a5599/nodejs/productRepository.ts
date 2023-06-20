import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { v4 as uuid } from "uuid";

// É necessário configurar o arquivo de Layer no arquivo tsconfig
export interface Product {
    id: string,
    productName: string,
    code: string,
    price: number,
    model: string,
    productUrl: string
}

export class ProductRepository {

    private ddbCliente: DocumentClient
    private productsDdb: string

    constructor(ddbClient: DocumentClient, productsDdb: string) {
        this.ddbCliente = ddbClient
        this.productsDdb = productsDdb
    }

    // pega todos os produtos
    async getAllProducts(): Promise<Product[]> {
        console.log('this.ddbCliente:', this.ddbCliente)
        console.log('this.productsDdb:', this.productsDdb)
        const data = await this.ddbCliente.scan({
            TableName: this.productsDdb
        }).promise()
        return data.Items as Product[]
    }

    async getProductById(productId: string): Promise<Product> {
        const data = await this.ddbCliente.get({
            TableName: this.productsDdb,
            Key: {
                id: productId
            }
        }).promise()
        if (data.Item) {
            return data.Item as Product
        } else {
            throw new Error('Product not found')
        }
    }

    async createProduct(product: Product): Promise<Product> {
        product.id = uuid()

        await this.ddbCliente.put({
            TableName: this.productsDdb,
            Item: product
        }).promise()

        return product
    }

    async deleteProduct(productId: string): Promise<Product> {

        const data = await this.ddbCliente.delete({
            TableName: this.productsDdb,
            Key: {
                id: productId
            },
            ReturnValues: "ALL_OLD" //retorna tudo que estava na tabela antes de excluir o item
        }).promise()

        // caso tenha o campo attributes, quer dizer que o item foi encontrado e excluido
        if (data.Attributes) {
            return data.Attributes as Product
        } else {
            throw new Error("Product not found");
            
        }
    }

    async updateProduct(productId: string, product: Product): Promise<Product> {

        const data = await this.ddbCliente.update({
            TableName: this.productsDdb,
            Key: {
                id: productId
            },
            ConditionExpression: 'attribute_exists(id)', // só vai acontecer se o id existir
            ReturnValues: 'UPDATED_NEW', // retorna o atributo atualizado
            UpdateExpression: "set productName = :n, code = :c, price = :p, model = :m, productUrl = :u",
            ExpressionAttributeValues: {
                ':n': product.productName,
                ':c': product.code,
                ':p': product.price,
                ':m': product.model,
                ':u': product.productUrl
            }
        }).promise()
        data.Attributes!.id = productId
        return data.Attributes as Product
    }

}