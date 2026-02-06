# n8n-nodes-fyo

This is an n8n community node for integrating with the [FYO API](https://www.fyo.com). It provides access to grain trading operations, financial transactions, and AFIP (Argentine tax authority) documentation.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `n8n-nodes-fyo` in the **Enter npm package name** field
4. Agree to the risks and select **Install**

### Manual Installation

To install this node manually in a self-hosted n8n instance:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-fyo
```

Then restart n8n.

## Credentials

To use this node, you need to configure the FYO API credentials:

| Field | Description |
|-------|-------------|
| **Client ID** | Your FYO API client identifier |
| **Username** | Your FYO username or email |
| **Password** | Your FYO account password |
| **Scope** | OAuth2 scope to request (provided by FYO) |
| **Environment** | Production, Demo, or Custom URL |

### Setting up credentials

1. In n8n, go to **Credentials > New**
2. Search for **FYO API**
3. Fill in your credentials provided by FYO
4. Click **Test** to verify the connection
5. Click **Save**

## Operations

### Grains Resource

Operations for grain trading management.

#### Get Contracts
Retrieve grain contracts.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| Broker Contract Number | Broker Contract Number |

#### Get Settlements
Retrieve grain settlements.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| Broker Contract Number | Broker Contract Number |
| Receipt Number | Receipt Number |

#### Get Invoices
Retrieve grain invoices.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| Broker Contract Number | Broker Contract Number |
| Receipt Number | Receipt Number |

#### Get Applications
Retrieve grain applications.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| Broker Contract Number | Broker Contract Number |
| CTG Number | CTG Number |

#### Get Fixings
Retrieve grain price fixings.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| Broker Contract Number | Broker Contract Number |
| Fixing Number | Fixing Number |

#### Get Unloads
Retrieve grain unloads.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| CTG Number | CTG Number |

#### Get Withholdings
Retrieve tax withholdings.

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| Receipt Number | Receipt Number |
| Payment Slip Number | Payment Slip Number |

### Finance Resource

Operations for financial transactions.

#### Get Receipt Types
Retrieve available receipt types. This is a GET request with no parameters.

#### Get Receipt Details
Retrieve details for a specific receipt.

| Parameter | Description |
|-----------|-------------|
| Receipt Number | Receipt number (required) |

#### Get Transactions
Retrieve financial transactions.

| Parameter | Description |
|-----------|-------------|
| Date From | Start date (required) |
| Date To | End date (required) |

### AFIP Resource

Operations for AFIP (Argentine Federal Administration of Public Revenue) documentation.

#### Get Waybills
Retrieve AFIP waybills (Carta de Porte - transport documents).

| Search By | Parameters |
|-----------|------------|
| Date Range | Date From (required), Date To (optional) |
| CTG Number | CTG Number |

## Validation

The node includes built-in validation:

- **Date validation**: Dates cannot be in the future and must be valid calendar dates
- **Date range**: Maximum range is 31 days (1 month) when both dates are provided
- **Numeric fields**: Required numeric fields (CTG Number, Broker Contract Number, etc.) must be greater than 0

## Authentication

This node uses OAuth2 Password Grant flow for authentication. The access token is automatically obtained using your credentials and cached to optimize API calls.

The authentication flow:
1. On first request, the node obtains an access token from the `/token` endpoint
2. The token is cached in memory with a 60-second buffer before expiry
3. All API requests include the token in the `Authorization: Bearer` header
4. When the token expires, a new one is automatically requested

## Compatibility

- **n8n version**: 1.0.0 or later
- **Node.js version**: 20.0.0 or later

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [FYO Website](https://www.fyo.com)

## Support

If you have questions or encounter issues:

- Open an issue on [GitHub](https://github.com/fyo-tech/n8n-nodes-fyo/issues)
- Contact FYO support at integracion@fyo.com

## License

[MIT](https://github.com/fyo-tech/n8n-nodes-fyo/blob/main/LICENSE)
