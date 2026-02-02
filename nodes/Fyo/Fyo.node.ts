import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

// Token cache: key = baseUrl+clientId+username, value = {token, expiresAt}
interface TokenCacheEntry {
	token: string;
	expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

// Helper function to get the base URL from credentials
function getBaseUrl(credentials: IDataObject): string {
	const environment = credentials.environment as string;
	if (environment === 'custom') {
		return credentials.customUrl as string;
	} else if (environment === 'demo') {
		return 'https://demoapi.fyo.com';
	}
	return 'https://api.fyo.com';
}

// Helper function to get access token with caching
async function getAccessToken(
	executeFunctions: IExecuteFunctions,
	credentials: IDataObject,
): Promise<string> {
	const baseUrl = getBaseUrl(credentials);
	const cacheKey = `${baseUrl}:${credentials.clientId}:${credentials.username}`;
	const now = Date.now();

	// Check if we have a valid cached token (with 60s buffer before expiry)
	const cached = tokenCache.get(cacheKey);
	if (cached && cached.expiresAt > now + 60000) {
		return cached.token;
	}

	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `${baseUrl}/token`,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: credentials.clientId as string,
			username: credentials.username as string,
			password: credentials.password as string,
			scope: credentials.scope as string,
			grant_type: 'password',
			response_type: 'token id_token',
		}).toString(),
	};

	const response = await executeFunctions.helpers.httpRequest(options);

	if (response.access_token) {
		// Cache the token - use expires_in if available, default to 1 hour
		const expiresIn = (response.expires_in as number) || 3600;
		tokenCache.set(cacheKey, {
			token: response.access_token as string,
			expiresAt: now + expiresIn * 1000,
		});
		return response.access_token as string;
	}

	throw new NodeApiError(executeFunctions.getNode(), {
		message: 'Failed to obtain access token from FYO API',
	});
}

export class Fyo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FYO',
		name: 'fyo',
		icon: 'file:fyo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with FYO API',
		defaults: {
			name: 'FYO',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'fyoApi',
				required: true,
			},
		],
		properties: [
			// Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Grains',
						value: 'granos',
					},
					{
						name: 'Finance',
						value: 'finanzas',
					},
					{
						name: 'AFIP',
						value: 'afip',
					},
				],
				default: 'granos',
			},

			// ====================
			// GRAINS OPERATIONS
			// ====================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['granos'],
					},
				},
				options: [
					{
						name: 'Get Contracts',
						value: 'getContratos',
						description: 'Retrieve grain contracts',
						action: 'Get contracts',
					},
					{
						name: 'Get Settlements',
						value: 'getLiquidaciones',
						description: 'Retrieve grain settlements',
						action: 'Get settlements',
					},
					{
						name: 'Get Invoices',
						value: 'getFacturas',
						description: 'Retrieve grain invoices',
						action: 'Get invoices',
					},
					{
						name: 'Get Applications',
						value: 'getAplicaciones',
						description: 'Retrieve grain applications',
						action: 'Get applications',
					},
					{
						name: 'Get Fixings',
						value: 'getFijaciones',
						description: 'Retrieve grain fixings',
						action: 'Get fixings',
					},
					{
						name: 'Get Unloads',
						value: 'getDescargas',
						description: 'Retrieve grain unloads',
						action: 'Get unloads',
					},
					{
						name: 'Get Withholdings',
						value: 'getRetenciones',
						description: 'Retrieve grain withholdings',
						action: 'Get withholdings',
					},
				],
				default: 'getContratos',
			},

			// ========== GRANOS - CONTRATOS ==========
			{
				displayName: 'Search By',
				name: 'searchTypeContratos',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getContratos'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Contract Number',
						value: 'byContractNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Contract Date From',
				name: 'fechaContratoDesde',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getContratos'],
						searchTypeContratos: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Contract Date To',
				name: 'fechaContratoHasta',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getContratos'],
						searchTypeContratos: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Broker Contract Number',
				name: 'numeroContratoCorredor',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getContratos'],
						searchTypeContratos: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The broker contract number',
			},

			// ========== GRANOS - LIQUIDACIONES ==========
			{
				displayName: 'Search By',
				name: 'searchTypeLiquidaciones',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Broker Contract Number',
						value: 'byContractNumber',
					},
					{
						name: 'Receipt Number',
						value: 'byReceiptNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaDesdeLiq',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
						searchTypeLiquidaciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaLiq',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
						searchTypeLiquidaciones: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Broker Contract Number',
				name: 'numeroContratoCorredorLiq',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
						searchTypeLiquidaciones: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The broker contract number',
			},
			{
				displayName: 'Receipt Number',
				name: 'numeroComprobanteLiq',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
						searchTypeLiquidaciones: ['byReceiptNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The receipt number',
			},

			// ========== GRANOS - FACTURAS ==========
			{
				displayName: 'Search By',
				name: 'searchTypeFacturas',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Broker Contract Number',
						value: 'byContractNumber',
					},
					{
						name: 'Receipt Number',
						value: 'byReceiptNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaDesdeFact',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
						searchTypeFacturas: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaFact',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
						searchTypeFacturas: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Broker Contract Number',
				name: 'numeroContratoCorredorFact',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
						searchTypeFacturas: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The broker contract number',
			},
			{
				displayName: 'Receipt Number',
				name: 'numeroComprobanteFact',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
						searchTypeFacturas: ['byReceiptNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The receipt number',
			},

			// ========== GRANOS - APLICACIONES ==========
			{
				displayName: 'Search By',
				name: 'searchTypeAplicaciones',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Broker Contract Number',
						value: 'byContractNumber',
					},
					{
						name: 'CTG Number',
						value: 'byCTG',
					},
					{
						name: 'Fixing Number',
						value: 'byFixingNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Application Date From',
				name: 'fechaAplicacionDesde',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Application Date To',
				name: 'fechaAplicacionHasta',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Broker Contract Number',
				name: 'numeroContratoCorredorApl',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The broker contract number',
			},
			{
				displayName: 'CTG Number',
				name: 'CTG',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byCTG'],
					},
				},
				default: '',
				required: true,
				description: 'The CTG number',
			},
			{
				displayName: 'Fixing Number',
				name: 'numeroFijacionApl',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byFixingNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The fixing number',
			},

			// ========== GRANOS - FIJACIONES ==========
			{
				displayName: 'Search By',
				name: 'searchTypeFijaciones',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Broker Contract Number',
						value: 'byContractNumber',
					},
					{
						name: 'Fixing Number',
						value: 'byFixingNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Fixing Date From',
				name: 'fechaFijacionDesde',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
						searchTypeFijaciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Fixing Date To',
				name: 'fechaFijacionHasta',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
						searchTypeFijaciones: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Broker Contract Number',
				name: 'numeroContratoCorredorFij',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
						searchTypeFijaciones: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The broker contract number',
			},
			{
				displayName: 'Fixing Number',
				name: 'numeroFijacion',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
						searchTypeFijaciones: ['byFixingNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The fixing number',
			},

			// ========== GRANOS - DESCARGAS ==========
			{
				displayName: 'Search By',
				name: 'searchTypeDescargas',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'CTG Number',
						value: 'byCTG',
					},
					{
						name: 'Broker Contract Number',
						value: 'byContractNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaDesdeDesc',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
						searchTypeDescargas: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaDesc',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
						searchTypeDescargas: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'CTG Number',
				name: 'numeroCTG',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
						searchTypeDescargas: ['byCTG'],
					},
				},
				default: '',
				required: true,
				description: 'The CTG number',
			},
			{
				displayName: 'Broker Contract Number',
				name: 'numeroContratoCorredorDesc',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
						searchTypeDescargas: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The broker contract number',
			},

			// ========== GRANOS - RETENCIONES ==========
			{
				displayName: 'Search By',
				name: 'searchTypeRetenciones',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Receipt Number',
						value: 'byReceiptNumber',
					},
					{
						name: 'Payment Slip Number',
						value: 'byPaymentSlip',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaDesdeRet',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
						searchTypeRetenciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaRet',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
						searchTypeRetenciones: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Receipt Number',
				name: 'numeroComprobanteRet',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
						searchTypeRetenciones: ['byReceiptNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The receipt number',
			},
			{
				displayName: 'Payment Slip Number',
				name: 'numeroMinutaPago',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
						searchTypeRetenciones: ['byPaymentSlip'],
					},
				},
				default: '',
				required: true,
				description: 'The payment slip number',
			},

			// ====================
			// FINANCE OPERATIONS
			// ====================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['finanzas'],
					},
				},
				options: [
					{
						name: 'Get Receipt Types',
						value: 'getTiposComprobante',
						description: 'Retrieve receipt types',
						action: 'Get receipt types',
					},
					{
						name: 'Get Receipt Details',
						value: 'getDetallesComprobante',
						description: 'Retrieve receipt details',
						action: 'Get receipt details',
					},
					{
						name: 'Get Transactions',
						value: 'getMovimientos',
						description: 'Retrieve financial transactions',
						action: 'Get transactions',
					},
				],
				default: 'getMovimientos',
			},

			// ========== FINANZAS - DETALLES COMPROBANTE ==========
			{
				displayName: 'Receipt Number',
				name: 'numeroComprobanteFin',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['finanzas'],
						operation: ['getDetallesComprobante'],
					},
				},
				default: '',
				required: true,
				description: 'The receipt number',
			},

			// ========== FINANZAS - MOVIMIENTOS ==========
			{
				displayName: 'Date From',
				name: 'fechaDesdeFin',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['finanzas'],
						operation: ['getMovimientos'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaFin',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['finanzas'],
						operation: ['getMovimientos'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format',
			},

			// ====================
			// AFIP OPERATIONS
			// ====================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['afip'],
					},
				},
				options: [
					{
						name: 'Get Settlements',
						value: 'getLiquidacionesAfip',
						description: 'Retrieve AFIP settlements',
						action: 'Get settlements',
					},
					{
						name: 'Get Waybills',
						value: 'getCartaPorte',
						description: 'Retrieve AFIP waybills (Carta de Porte)',
						action: 'Get waybills',
					},
				],
				default: 'getLiquidacionesAfip',
			},

			// ========== AFIP - LIQUIDACIONES ==========
			{
				displayName: 'Search By',
				name: 'searchTypeAfipLiq',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getLiquidacionesAfip'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'Receipt Number',
						value: 'byReceiptNumber',
					},
					{
						name: 'Contract Number',
						value: 'byContractNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaDesdeAfipLiq',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getLiquidacionesAfip'],
						searchTypeAfipLiq: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaAfipLiq',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getLiquidacionesAfip'],
						searchTypeAfipLiq: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'Receipt Number',
				name: 'numeroComprobanteAfip',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getLiquidacionesAfip'],
						searchTypeAfipLiq: ['byReceiptNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The receipt number',
			},
			{
				displayName: 'Contract Number',
				name: 'numeroContratoAfip',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getLiquidacionesAfip'],
						searchTypeAfipLiq: ['byContractNumber'],
					},
				},
				default: '',
				required: true,
				description: 'The contract number',
			},

			// ========== AFIP - CARTA DE PORTE ==========
			{
				displayName: 'Search By',
				name: 'searchTypeCartaPorte',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getCartaPorte'],
					},
				},
				options: [
					{
						name: 'Date Range',
						value: 'byDates',
					},
					{
						name: 'CTG Number',
						value: 'byCTG',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Unload Date From',
				name: 'fechaDescargaDesde',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getCartaPorte'],
						searchTypeCartaPorte: ['byDates'],
					},
				},
				default: '',
				required: true,
				placeholder: '2024-01-01',
				description: 'Start date in YYYY-MM-DD format',
			},
			{
				displayName: 'Unload Date To',
				name: 'fechaDescargaHasta',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getCartaPorte'],
						searchTypeCartaPorte: ['byDates'],
					},
				},
				default: '',
				placeholder: '2024-12-31',
				description: 'End date in YYYY-MM-DD format (optional)',
			},
			{
				displayName: 'CTG Number',
				name: 'nroCTG',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getCartaPorte'],
						searchTypeCartaPorte: ['byCTG'],
					},
				},
				default: '',
				required: true,
				description: 'The CTG number',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const credentials = await this.getCredentials('fyoApi');
		const baseUrl = getBaseUrl(credentials);

		// Get access token
		const accessToken = await getAccessToken(this, credentials);

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let responseData: IDataObject = {};
				let endpoint = '';
				const body: IDataObject = {};

				// ====================
				// GRAINS
				// ====================
				if (resource === 'granos') {
					if (operation === 'getContratos') {
						endpoint = '/granos/contratos';
						const searchType = this.getNodeParameter('searchTypeContratos', i) as string;
						if (searchType === 'byDates') {
							body.fechaContratoDesde = this.getNodeParameter('fechaContratoDesde', i) as string;
							const fechaHasta = this.getNodeParameter('fechaContratoHasta', i) as string;
							if (fechaHasta) body.fechaContratoHasta = fechaHasta;
						} else {
							body.numeroContratoCorredor = this.getNodeParameter('numeroContratoCorredor', i) as number;
						}
					} else if (operation === 'getLiquidaciones') {
						endpoint = '/granos/liquidaciones';
						const searchType = this.getNodeParameter('searchTypeLiquidaciones', i) as string;
						if (searchType === 'byDates') {
							body.fechaDesde = this.getNodeParameter('fechaDesdeLiq', i) as string;
							const fechaHasta = this.getNodeParameter('fechaHastaLiq', i) as string;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = this.getNodeParameter('numeroContratoCorredorLiq', i) as number;
						} else {
							body.numeroComprobante = this.getNodeParameter('numeroComprobanteLiq', i) as number;
						}
					} else if (operation === 'getFacturas') {
						endpoint = '/granos/facturas';
						const searchType = this.getNodeParameter('searchTypeFacturas', i) as string;
						if (searchType === 'byDates') {
							body.fechaDesde = this.getNodeParameter('fechaDesdeFact', i) as string;
							const fechaHasta = this.getNodeParameter('fechaHastaFact', i) as string;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = this.getNodeParameter('numeroContratoCorredorFact', i) as number;
						} else {
							body.numeroComprobante = this.getNodeParameter('numeroComprobanteFact', i) as number;
						}
					} else if (operation === 'getAplicaciones') {
						endpoint = '/granos/aplicaciones';
						const searchType = this.getNodeParameter('searchTypeAplicaciones', i) as string;
						if (searchType === 'byDates') {
							body.fechaAplicacionDesde = this.getNodeParameter('fechaAplicacionDesde', i) as string;
							const fechaHasta = this.getNodeParameter('fechaAplicacionHasta', i) as string;
							if (fechaHasta) body.fechaAplicacionHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = this.getNodeParameter('numeroContratoCorredorApl', i) as number;
						} else if (searchType === 'byCTG') {
							body.CTG = this.getNodeParameter('CTG', i) as number;
						} else {
							body.numeroFijacion = this.getNodeParameter('numeroFijacionApl', i) as number;
						}
					} else if (operation === 'getFijaciones') {
						endpoint = '/granos/fijaciones';
						const searchType = this.getNodeParameter('searchTypeFijaciones', i) as string;
						if (searchType === 'byDates') {
							body.fechaFijacionDesde = this.getNodeParameter('fechaFijacionDesde', i) as string;
							const fechaHasta = this.getNodeParameter('fechaFijacionHasta', i) as string;
							if (fechaHasta) body.fechaFijacionHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = this.getNodeParameter('numeroContratoCorredorFij', i) as number;
						} else {
							body.numeroFijacion = this.getNodeParameter('numeroFijacion', i) as number;
						}
					} else if (operation === 'getDescargas') {
						endpoint = '/granos/descargas';
						const searchType = this.getNodeParameter('searchTypeDescargas', i) as string;
						if (searchType === 'byDates') {
							body.fechaDesde = this.getNodeParameter('fechaDesdeDesc', i) as string;
							const fechaHasta = this.getNodeParameter('fechaHastaDesc', i) as string;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byCTG') {
							body.numeroCTG = this.getNodeParameter('numeroCTG', i) as number;
						} else {
							body.numeroContratoCorredor = this.getNodeParameter('numeroContratoCorredorDesc', i) as number;
						}
					} else if (operation === 'getRetenciones') {
						endpoint = '/granos/retenciones';
						const searchType = this.getNodeParameter('searchTypeRetenciones', i) as string;
						if (searchType === 'byDates') {
							body.fechaDesde = this.getNodeParameter('fechaDesdeRet', i) as string;
							const fechaHasta = this.getNodeParameter('fechaHastaRet', i) as string;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byReceiptNumber') {
							body.numeroComprobante = this.getNodeParameter('numeroComprobanteRet', i) as number;
						} else {
							body.numeroMinutaPago = this.getNodeParameter('numeroMinutaPago', i) as number;
						}
					}
				}

				// ====================
				// FINANCE
				// ====================
				if (resource === 'finanzas') {
					if (operation === 'getTiposComprobante') {
						endpoint = '/finanzas/extranet/tiposcomprobante';
						// GET request, no body needed
						const options: IHttpRequestOptions = {
							method: 'GET',
							url: `${baseUrl}${endpoint}`,
							headers: {
								Authorization: `Bearer ${accessToken}`,
								'Content-Type': 'application/json',
							},
							json: true,
						};
						responseData = await this.helpers.httpRequest(options);
					} else if (operation === 'getDetallesComprobante') {
						endpoint = '/finanzas/extranet/detallescomprobante';
						body.numeroComprobante = this.getNodeParameter('numeroComprobanteFin', i) as number;
					} else if (operation === 'getMovimientos') {
						endpoint = '/finanzas/extranet/movimientos';
						body.fechaDesde = this.getNodeParameter('fechaDesdeFin', i) as string;
						body.fechaHasta = this.getNodeParameter('fechaHastaFin', i) as string;
					}
				}

				// ====================
				// AFIP
				// ====================
				if (resource === 'afip') {
					if (operation === 'getLiquidacionesAfip') {
						endpoint = '/afip/liquidaciones';
						const searchType = this.getNodeParameter('searchTypeAfipLiq', i) as string;
						if (searchType === 'byDates') {
							body.fechaDesde = this.getNodeParameter('fechaDesdeAfipLiq', i) as string;
							const fechaHasta = this.getNodeParameter('fechaHastaAfipLiq', i) as string;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byReceiptNumber') {
							body.numeroComprobante = this.getNodeParameter('numeroComprobanteAfip', i) as number;
						} else {
							body.numeroContrato = this.getNodeParameter('numeroContratoAfip', i) as number;
						}
					} else if (operation === 'getCartaPorte') {
						endpoint = '/afip/cartaporte';
						const searchType = this.getNodeParameter('searchTypeCartaPorte', i) as string;
						if (searchType === 'byDates') {
							body.fechaDescargaDesde = this.getNodeParameter('fechaDescargaDesde', i) as string;
							const fechaHasta = this.getNodeParameter('fechaDescargaHasta', i) as string;
							if (fechaHasta) body.fechaDescargaHasta = fechaHasta;
						} else {
							body.nroCTG = this.getNodeParameter('nroCTG', i) as number;
						}
					}
				}

				// Make POST request if we haven't already made a GET request
				if (operation !== 'getTiposComprobante') {
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: `${baseUrl}${endpoint}`,
						headers: {
							Authorization: `Bearer ${accessToken}`,
							'Content-Type': 'application/json',
						},
						body,
						json: true,
					};
					responseData = await this.helpers.httpRequest(options);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);

				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
					returnData.push({
						json: { error: errorMessage },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), {
					message: error instanceof Error ? error.message : 'Unknown error occurred',
				});
			}
		}

		return [returnData];
	}
}
