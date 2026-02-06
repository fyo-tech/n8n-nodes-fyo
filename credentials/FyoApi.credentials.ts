import type {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FyoApi implements ICredentialType {
	name = 'fyoApi';
	displayName = 'FYO API';
	documentationUrl = 'https://api.fyo.com/docs';
	testedBy = 'fyoApiCredentialTest';
	properties: INodeProperties[] = [
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
}
