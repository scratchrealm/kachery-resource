import WebSocket from "ws";
import { Config, sleepMsec } from ".";
import FileUploadJob from "./FileUploadJob";
import { FileUploadRequest, FileUploadResponse, isKacheryResourceRequest, KacheryResourceRequest, KacheryResourceResponse } from "./KacheryResourceRequest";
import { InitializeMessageFromResource, isAcknowledgeMessageToResource, isRequestFromClient, PingMessageFromResource, RequestFromClient, ResponseToClient } from "./types";

class ResourceClient {
    #webSocket: WebSocket | undefined = undefined
    #fileUploadJobs: {[uri: string]: FileUploadJob} = {}
    #acknowledged = false
    constructor(private config: Config) {
        this.keepAlive()
    }
    async keepAlive() {
        await sleepMsec(1000 * 10)
        while (true) {
            if ((this.#webSocket) && (this.#acknowledged)) {
                const msg: PingMessageFromResource = {type: 'ping'}
                this.#webSocket.send(JSON.stringify(msg))
            }
            await sleepMsec(1000 * 20)
        }
    }
    async run() {
        if (this.#webSocket) {
            console.error('Websocket already exists.')
            return
        }
        return new Promise<void>((resolve) => {
            this.#acknowledged = false
            console.info(`Connecting to ${this.config.proxyUrl}`)
            const wsUrl = this.config.proxyUrl.replace('http:','ws:').replace('https:','wss:')
            const ws = new WebSocket(wsUrl)
            this.#webSocket = ws
            ws.on('open', () => {
                console.info('Connected')
                const msg: InitializeMessageFromResource = {
                    type: 'initialize',
                    resourceName: this.config.resourceName,
                    zone: this.config.kacheryZone,
                    proxySecret: this.config.proxySecret
                }
                ws.send(JSON.stringify(msg))
            })
            ws.on('close', () => {
                console.info('Websocket closed.')
                this.#webSocket = undefined
                resolve()
            })
            ws.on('message', msg => {                
                const messageJson = msg.toString()
                let message: any
                try {
                    message = JSON.parse(messageJson)
                }
                catch(err) {
                    console.error(`Error parsing message. Closing.`)
                    ws.close()
                    return
                }
                if (isAcknowledgeMessageToResource(message)) {
                    console.info('Connection acknowledged by proxy server')
                    console.info('')
                    console.info(`Resource URL: ${this.config.proxyUrl}/r/${this.config.resourceName}`)
                    console.info('')
                    this.#acknowledged = true
                    return
                }
                if (!this.#acknowledged) {
                    console.info('Unexpected, message before connection acknowledged. Closing.')
                    ws.close()
                    return
                }
                if (isRequestFromClient(message)) {
                    this.handleRequestFromClient(message)
                }
                else {
                    console.warn(message)
                    console.warn('Unexpected message from proxy server')
                }
            })
        })
    }
    async handleRequestFromClient(request: RequestFromClient) {
        if (!this.#webSocket) return
        const rr = request.request
        if (!isKacheryResourceRequest(rr)) {
            console.warn('Received invalid kachery resource request.')
            const resp: ResponseToClient = {
                type: 'responseToClient',
                requestId: request.requestId,
                response: {},
                error: 'Invalid kachery resource request'
            }
            this.#webSocket.send(JSON.stringify(resp))    
            return
        }
        let kacheryResponse: KacheryResourceResponse
        try {
            kacheryResponse = await this.handleRequest(rr, request.requestId)
        }
        catch(err) {
            console.warn('Error processing request', rr.type, err.message)
            const resp: ResponseToClient = {
                type: 'responseToClient',
                requestId: request.requestId,
                response: {},
                error: `Error handling request: ${err.message}`
            }
            this.#webSocket.send(JSON.stringify(resp))    
            return
        }
        if (!this.#webSocket) return
        const responseToClient: ResponseToClient = {
            type: 'responseToClient',
            requestId: request.requestId,
            response: kacheryResponse
        }
        this.#webSocket.send(JSON.stringify(responseToClient))
    }
    async handleRequest(request: KacheryResourceRequest, requestId?: string): Promise<KacheryResourceResponse> {
        if (request.type === 'fileUpload') {
            return await this.handleFileUploadRequest(request, requestId)
        }
        else {
            throw Error(`Unexpected request ${request.type}`)
        }
    }
    async handleFileUploadRequest(request: FileUploadRequest, requestId?: string): Promise<FileUploadResponse> {
        const {uri} = request
        if (!isValidUri(uri)) throw Error('Invalid URI')
        console.info(`Upload request: ${uri}`)
        if (uri in this.#fileUploadJobs) {
            const j0 = this.#fileUploadJobs[uri]
            if (j0.isRunning) {
                return {
                    type: 'fileUpload',
                    status: j0.status
                }
            }
        }
        {
            const j1 = new FileUploadJob(uri)
            if (requestId) j1.setRequestId(requestId)
            await j1.initialize()
            j1.onStatusChange(() => {
                this._processQueuedJobs()
            })
            if (j1.status.status !== 'not-found') {
                this.#fileUploadJobs[uri] = j1
            }
            if (j1.status.status === 'queued') {
                if (this._getNumRunningJobs() < (this.config.maxConcurrentUploads || 0)) {
                    console.info(`Starting upload: ${uri}`)
                    j1.startUpload()
                }
                // if uploading, wait to see if we can complete it before responding to the request
                await j1.waitForCompleted(request.timeoutMsec)
            }
            return {
                type: 'fileUpload',
                status: j1.status
            }
        }
    }
    _getNumRunningJobs() {
        return Object.values(this.#fileUploadJobs).filter(a => (a.status.status === 'running')).length
    }
    _processQueuedJobs() {
        let nn = this._getNumRunningJobs()
        const max = (this.config.maxConcurrentUploads || 0)
        const jobs = Object.values(this.#fileUploadJobs)
            .filter(j => (j.status.status === 'queued'))
            .sort((j1, j2) => (j1.timestampCreated - j2.timestampCreated))
        let i = 0
        while ((nn < max) && (i < jobs.length)) {
            jobs[i].startUpload()
            nn ++
            i ++
        }
    }
}

const isValidUri = (uri: string) => {
    const a = uri.split('/')
    if (a.length !== 3) return false
    if (a[0] !== 'sha1:') return false
    if (a[1] !== '') return false
    if (a[2].length !== 40) return false
    return true
}

export default ResourceClient