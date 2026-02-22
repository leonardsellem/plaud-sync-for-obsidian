import {requestUrl, type RequestUrlParam} from 'obsidian';
import {createPlaudApiClient, type CreatePlaudApiClientOptions, type PlaudRequest, type PlaudRequestResult} from './plaud-api';

function obsidianRequest(request: PlaudRequest): Promise<PlaudRequestResult> {
	return requestUrl(request as RequestUrlParam) as Promise<PlaudRequestResult>;
}

export function createObsidianPlaudApiClient(options: Omit<CreatePlaudApiClientOptions, 'request'>) {
	return createPlaudApiClient({...options, request: obsidianRequest});
}
