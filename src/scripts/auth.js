const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity');
const { HttpsProxyAgent } = require('https-proxy-agent');

function createCosmosClient(endpoint, databaseId) {
    let proxyAgent = null;
    if (process.env.http_proxy) {
        proxyAgent = new HttpsProxyAgent(process.env.http_proxy);
    }

    let client;

    // Check for service principal credentials in environment variables
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (clientId && clientSecret && tenantId) {
        // Use service principal credentials
        const credentials = new ClientSecretCredential(tenantId, clientId, clientSecret);
        client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            aadCredentials: credentials
        });
    } else {
        // Fallback to managed identity
        client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            aadCredentials: new DefaultAzureCredential()
        });
    }

    return client;
}

module.exports = { createCosmosClient }; 