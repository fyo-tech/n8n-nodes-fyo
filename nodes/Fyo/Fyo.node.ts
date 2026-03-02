import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

// Helper function to convert dateTime to YYYY-MM-DD format
function formatDateForApi(dateValue: string): string {
	if (!dateValue) return '';

	// If already in YYYY-MM-DD format, return as is
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
		return dateValue;
	}

	// Parse ISO datetime or other formats
	const date = new Date(dateValue);
	if (isNaN(date.getTime())) {
		throw new Error(`Invalid date value: "${dateValue}"`);
	}

	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

// Helper function to validate date existence
function validateDate(dateString: string, fieldName: string): string {
	if (!dateString) return '';

	const formatted = formatDateForApi(dateString);
	const [year, month, day] = formatted.split('-').map(Number);

	// Check if the date actually exists
	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		const lastDayOfMonth = new Date(year, month, 0).getDate();
		throw new Error(
			`Invalid date "${fieldName}": "${formatted}" does not exist. ` +
			`${getMonthName(month)} ${year} has ${lastDayOfMonth} days.`
		);
	}

	// Check if the date is not in the future
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	if (date > today) {
		throw new Error(
			`Invalid date "${fieldName}": "${formatted}" cannot be greater than today's date.`
		);
	}

	return formatted;
}

// Helper function to validate date range (max 1 month)
function validateDateRange(dateFrom: string, dateTo: string): void {
	if (!dateFrom || !dateTo) return;

	const from = new Date(dateFrom);
	const to = new Date(dateTo);

	if (to < from) {
		throw new Error(`Date range invalid: "Date To" (${dateTo}) cannot be before "Date From" (${dateFrom})`);
	}

	// Calculate difference in days
	const diffTime = to.getTime() - from.getTime();
	const diffDays = diffTime / (1000 * 60 * 60 * 24);

	// Max 31 days (approximately 1 month)
	if (diffDays > 31) {
		throw new Error(
			`Date range exceeds maximum allowed (1 month). ` +
			`From "${dateFrom}" to "${dateTo}" is ${Math.ceil(diffDays)} days. ` +
			`Please reduce the date range to 31 days or less.`
		);
	}
}

function getMonthName(month: number): string {
	const months = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	return months[month - 1] || 'Unknown';
}

// Helper function to validate required numeric fields
function validateRequiredNumber(value: number | string, fieldName: string): number {
	const num = typeof value === 'string' ? parseInt(value, 10) : value;
	if (!num || num <= 0 || isNaN(num)) {
		throw new Error(`${fieldName} must be a valid number greater than 0`);
	}
	return num;
}

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


export class Fyo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FyO',
		name: 'fyo',
		icon: 'file:fyo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with FYO API',
		defaults: {
			name: 'FyO',
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
						name: 'Broker Contract Number',
						value: 'byContractNumber',
					},
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaContratoDesde',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getContratos'],
						searchTypeContratos: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaContratoHasta',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getContratos'],
						searchTypeContratos: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
						searchTypeLiquidaciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaLiq',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getLiquidaciones'],
						searchTypeLiquidaciones: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
						searchTypeFacturas: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaFact',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFacturas'],
						searchTypeFacturas: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaAplicacionDesde',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaAplicacionHasta',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getAplicaciones'],
						searchTypeAplicaciones: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				displayName: 'Date From',
				name: 'fechaFijacionDesde',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
						searchTypeFijaciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaFijacionHasta',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getFijaciones'],
						searchTypeFijaciones: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				],
				default: 'byDates',
			},
			{
				displayName: 'Date From',
				name: 'fechaDesdeDesc',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
						searchTypeDescargas: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaDesc',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getDescargas'],
						searchTypeDescargas: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
						searchTypeRetenciones: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaRet',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['granos'],
						operation: ['getRetenciones'],
						searchTypeRetenciones: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['finanzas'],
						operation: ['getMovimientos'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaHastaFin',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['finanzas'],
						operation: ['getMovimientos'],
					},
				},
				default: '',
				required: true,
				description: 'End date for the search range (max 1 month from start)',
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
						name: 'Get Waybills',
						value: 'getCartaPorte',
						description: 'Retrieve AFIP waybills (Carta de Porte)',
						action: 'Get waybills',
					},
				],
				default: 'getCartaPorte',
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
				displayName: 'Date From',
				name: 'fechaDescargaDesde',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getCartaPorte'],
						searchTypeCartaPorte: ['byDates'],
					},
				},
				default: '',
				required: true,
				description: 'Start date for the search range (max 1 month range)',
			},
			{
				displayName: 'Date To',
				name: 'fechaDescargaHasta',
				type: 'dateTime',
				displayOptions: {
					show: {
						resource: ['afip'],
						operation: ['getCartaPorte'],
						searchTypeCartaPorte: ['byDates'],
					},
				},
				default: '',
				description: 'End date for the search range (optional, max 1 month from start)',
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
							const fechaDesde = validateDate(this.getNodeParameter('fechaContratoDesde', i) as string, 'Contract Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaContratoHasta', i) as string, 'Contract Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaContratoDesde = fechaDesde;
							if (fechaHasta) body.fechaContratoHasta = fechaHasta;
						} else {
							body.numeroContratoCorredor = validateRequiredNumber(this.getNodeParameter('numeroContratoCorredor', i) as number, 'Broker Contract Number');
						}
					} else if (operation === 'getLiquidaciones') {
						endpoint = '/granos/liquidaciones';
						const searchType = this.getNodeParameter('searchTypeLiquidaciones', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaDesdeLiq', i) as string, 'Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaHastaLiq', i) as string, 'Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaDesde = fechaDesde;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = validateRequiredNumber(this.getNodeParameter('numeroContratoCorredorLiq', i) as number, 'Broker Contract Number');
						} else {
							body.numeroComprobante = validateRequiredNumber(this.getNodeParameter('numeroComprobanteLiq', i) as number, 'Receipt Number');
						}
					} else if (operation === 'getFacturas') {
						endpoint = '/granos/facturas';
						const searchType = this.getNodeParameter('searchTypeFacturas', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaDesdeFact', i) as string, 'Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaHastaFact', i) as string, 'Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaDesde = fechaDesde;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = validateRequiredNumber(this.getNodeParameter('numeroContratoCorredorFact', i) as number, 'Broker Contract Number');
						} else {
							body.numeroComprobante = validateRequiredNumber(this.getNodeParameter('numeroComprobanteFact', i) as number, 'Receipt Number');
						}
					} else if (operation === 'getAplicaciones') {
						endpoint = '/granos/aplicaciones';
						const searchType = this.getNodeParameter('searchTypeAplicaciones', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaAplicacionDesde', i) as string, 'Application Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaAplicacionHasta', i) as string, 'Application Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaAplicacionDesde = fechaDesde;
							if (fechaHasta) body.fechaAplicacionHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = validateRequiredNumber(this.getNodeParameter('numeroContratoCorredorApl', i) as number, 'Broker Contract Number');
						} else if (searchType === 'byCTG') {
							body.CTG = validateRequiredNumber(this.getNodeParameter('CTG', i) as number, 'CTG Number');
						}
					} else if (operation === 'getFijaciones') {
						endpoint = '/granos/fijaciones';
						const searchType = this.getNodeParameter('searchTypeFijaciones', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaFijacionDesde', i) as string, 'Fixing Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaFijacionHasta', i) as string, 'Fixing Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaFijacionDesde = fechaDesde;
							if (fechaHasta) body.fechaFijacionHasta = fechaHasta;
						} else if (searchType === 'byContractNumber') {
							body.numeroContratoCorredor = validateRequiredNumber(this.getNodeParameter('numeroContratoCorredorFij', i) as number, 'Broker Contract Number');
						} else {
							body.numeroFijacion = validateRequiredNumber(this.getNodeParameter('numeroFijacion', i) as number, 'Fixing Number');
						}
					} else if (operation === 'getDescargas') {
						endpoint = '/granos/descargas';
						const searchType = this.getNodeParameter('searchTypeDescargas', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaDesdeDesc', i) as string, 'Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaHastaDesc', i) as string, 'Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaDesde = fechaDesde;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byCTG') {
							body.numeroCTG = validateRequiredNumber(this.getNodeParameter('numeroCTG', i) as number, 'CTG Number');
						}
					} else if (operation === 'getRetenciones') {
						endpoint = '/granos/retenciones';
						const searchType = this.getNodeParameter('searchTypeRetenciones', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaDesdeRet', i) as string, 'Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaHastaRet', i) as string, 'Date To');
							if (fechaHasta) validateDateRange(fechaDesde, fechaHasta);
							body.fechaDesde = fechaDesde;
							if (fechaHasta) body.fechaHasta = fechaHasta;
						} else if (searchType === 'byReceiptNumber') {
							body.numeroComprobante = validateRequiredNumber(this.getNodeParameter('numeroComprobanteRet', i) as number, 'Receipt Number');
						} else {
							body.numeroMinutaPago = validateRequiredNumber(this.getNodeParameter('numeroMinutaPago', i) as number, 'Payment Slip Number');
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
							json: true,
						};
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'fyoApi', options);
					} else if (operation === 'getDetallesComprobante') {
						endpoint = '/finanzas/extranet/detallescomprobante';
						body.numeroComprobante = validateRequiredNumber(this.getNodeParameter('numeroComprobanteFin', i) as number, 'Receipt Number');
					} else if (operation === 'getMovimientos') {
						endpoint = '/finanzas/extranet/movimientos';
						const fechaDesde = validateDate(this.getNodeParameter('fechaDesdeFin', i) as string, 'Date From');
						const fechaHasta = validateDate(this.getNodeParameter('fechaHastaFin', i) as string, 'Date To');
						validateDateRange(fechaDesde, fechaHasta);
						body.fechaDesde = fechaDesde;
						body.fechaHasta = fechaHasta;
						body.pageSize = 1000;
					}
				}

				// ====================
				// AFIP
				// ====================
				if (resource === 'afip') {
					if (operation === 'getCartaPorte') {
						endpoint = '/afip/cartaporte';
						const searchType = this.getNodeParameter('searchTypeCartaPorte', i) as string;
						if (searchType === 'byDates') {
							const fechaDesde = validateDate(this.getNodeParameter('fechaDescargaDesde', i) as string, 'Unload Date From');
							const fechaHasta = validateDate(this.getNodeParameter('fechaDescargaHasta', i) as string, 'Unload Date To');
							body.fechaDescargaDesde = fechaDesde;
							if (fechaHasta) body.fechaDescargaHasta = fechaHasta;
						} else {
							body.nroCTG = validateRequiredNumber(this.getNodeParameter('nroCTG', i) as number, 'CTG Number');
						}
					}
				}

				// Make POST request if we haven't already made a GET request
				if (operation !== 'getTiposComprobante') {
					const options: IHttpRequestOptions = {
						method: 'POST',
						url: `${baseUrl}${endpoint}`,
						headers: {
							'Content-Type': 'application/json',
						},
						body,
						json: true,
					};
					responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'fyoApi', options);
				}

				// Extract data array from response structure
				// Response format: [{ status: {...}, metadata: {...}, data: [...] }]
				let dataItems: IDataObject[] = [];

				if (Array.isArray(responseData)) {
					// Response is an array (standard FYO API response)
					const firstResponse = responseData[0] as IDataObject;
					if (firstResponse && Array.isArray(firstResponse.data)) {
						dataItems = firstResponse.data as IDataObject[];
					} else if (firstResponse && !firstResponse.data) {
						// Response might be a direct array of items
						dataItems = responseData as IDataObject[];
					}
				} else if (responseData && typeof responseData === 'object') {
					// Response is a single object
					if (Array.isArray((responseData as IDataObject).data)) {
						dataItems = (responseData as IDataObject).data as IDataObject[];
					} else {
						// Single item response
						dataItems = [responseData as IDataObject];
					}
				}

				// Return each data item as a separate n8n item
				for (const dataItem of dataItems) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(dataItem),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
				}
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
