const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity');
const { HttpsProxyAgent } = require('https-proxy-agent');

function createCosmosClient(endpoint) {
    let proxyAgent = null;
    if (process.env.http_proxy) {
        proxyAgent = new HttpsProxyAgent(process.env.http_proxy);
        console.log(`Using proxy: ${process.env.http_proxy}`);
    }

    let client;

    // Check for service principal credentials in environment variables
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;

    if (clientId && clientSecret && tenantId) {
        // Use service principal credentials
        const clientOptions = process.env.http_proxy ? { proxyOptions: { host: process.env.http_proxy } } : {};
        const credentials = new ClientSecretCredential(tenantId, clientId, clientSecret, clientOptions);
        console.log(`Using provided clientId: ${clientId}`);

        client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            aadCredentials: credentials
        });
    } else {
        // Fallback to managed identity
        console.log(`Using managed identity.`);
        client = new CosmosClient({
            endpoint,
            agent: proxyAgent,
            aadCredentials: new DefaultAzureCredential()
        });
    }

    return client;
}

module.exports = { createCosmosClient }; 