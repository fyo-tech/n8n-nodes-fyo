import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestHelper,
	INodeProperties,
} from 'n8n-workflow';

export class FyoApi implements ICredentialType {
	name = 'fyoApi';
	displayName = 'fyo API';
	documentationUrl = 'https://api.fyo.com/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
			},
			default: '',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'The Client ID for FYO API',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'Your FYO username or email',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Your FYO password',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default: '',
			required: true,
			description: 'The OAuth2 scope to request',
			placeholder: 'e.g., read write',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Production',
					value: 'production',
				},
				{
					name: 'Demo',
					value: 'demo',
				},
				{
					name: 'Custom',
					value: 'custom',
				},
			],
			default: 'production',
			description: 'Select the FYO API environment',
		},
		{
			displayName: 'Custom URL',
			name: 'customUrl',
			type: 'string',
			default: 'http://localhost:3000',
			required: true,
			displayOptions: {
				show: {
					environment: ['custom'],
				},
			},
			description: 'Custom API base URL (e.g., http://localhost:3000)',
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const environment = credentials.environment as string;
		const baseUrl =
			environment === 'custom'
				? (credentials.customUrl as string)
				: environment === 'demo'
					? 'https://demoapi.fyo.com'
					: 'https://api.fyo.com';

		const response = (await this.helpers.httpRequest({
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
		})) as { access_token: string };

		return { accessToken: response.access_token };
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{ $credentials.environment === "custom" ? $credentials.customUrl : ($credentials.environment === "demo" ? "https://demoapi.fyo.com" : "https://api.fyo.com") }}',
			url: '/finanzas/extranet/tiposcomprobante',
			method: 'GET',
		},
	};
}
