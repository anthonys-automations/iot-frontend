const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const HttpsProxyAgent = require('https-proxy-agent');

class CosmosDBReader {
    constructor(endpoint, databaseId, containerId) {
        console.log(`Initializing CosmosDBReader with endpoint: ${endpoint}, databaseId: ${databaseId}, containerId: ${containerId}`);

        // Use proxy settings from environment variables
        const http_proxy = process.env.http_proxy;
        const proxyAgent = new HttpsProxyAgent(http_proxy);

        this.client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            // key: "fOcC1URYChAu4KeS4WTxvz8kl1GdkhjM2FX5JdU8VzbJuttKcd78YE7RETvTNdOuSHAmDskVAsQCACDb1TkzCg=="
            aadCredentials: new DefaultAzureCredential()
        });
        this.databaseId = databaseId;
        this.containerId = containerId;
    }

    async getItems() {
        try {
            console.log(`Fetching items from database: ${this.databaseId}, container: ${this.containerId}`);
            const database = this.client.database(this.databaseId);
            const container = database.container(this.containerId);
            const { resources: items } = await container.items.query('SELECT * FROM c').fetchAll();
            console.log(`Fetched items: ${JSON.stringify(items, null, 2)}`);
            return items.map(item => ({
                properties: item.Properties,
                timestamp: item.SystemProperties["iothub-enqueuedtime"],
                ...item.Body
            }));
        } catch (error) {
            console.error(`Error fetching items: ${error.message}`);
            throw error;
        }
    }
}

module.exports = CosmosDBReader;
