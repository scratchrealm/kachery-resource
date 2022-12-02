import { Config } from ".";
import WebSocket from "ws";
import { InitializeMessageFromResource, isAcknowledgeMessageToResource, isRequestFromClient, RequestFromClient, ResponseToClient } from "./types";
import { FileUploadRequest, FileUploadResponse, isKacheryResourceRequest, KacheryResourceRequest, KacheryResourceResponse } from "./KacheryResourceRequest";
import FileUploadJob from "./FileUploadJob";

class ResourceClient {
    #webSocket: WebSocket | undefined = undefined
    #fileUploadJobs: {[uri: string]: FileUploadJob} = {}
    constructor(private config: Config) {
    }
    async run() {
        if (this.#webSocket) {
            console.error('Websocket already exists.')
            return
        }
        return new Promise<void>((resolve) => {
            console.info(`Connecting to ${this.config.proxyUrl}`)
            const ws = new WebSocket(this.config.proxyUrl)
            this.#webSocket = this.#webSocket
            ws.on('open', () => {
                console.info('Connected')
                const msg: InitializeMessageFromResource = {
                    type: 'initialize',
                    resourceName: this.config.resourceName,
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
                let acknowledged = false
                if (isAcknowledgeMessageToResource(message)) {
                    console.info('Connection acknowledged by proxy server')
                    acknowledged = true
                    return
                }
                if (!acknowledged) {
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
            kacheryResponse = await this.handleRequest(rr)
        }
        catch(err) {
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
    async handleRequest(request: KacheryResourceRequest): Promise<KacheryResourceResponse> {
        if (request.type === 'fileUpload') {
            return await this.handleFileUploadRequest(request)
        }
        else {
            throw Error(`Unexpected request ${request.type}`)
        }
    }
    async handleFileUploadRequest(request: FileUploadRequest): Promise<FileUploadResponse> {
        const {uri} = request
        if (!isValidUri(uri)) throw Error('Invalid URI')
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
            await j1.initialize()
            if (j1.status.status !== 'not-found') {
                this.#fileUploadJobs[uri] = j1
            }
            if (j1.status.status === 'uploading') {
                // if uploading, wait a bit to see if we can complete it before responding to the request
                await j1.waitForCompleted(1000 * 10)
            }
            return {
                type: 'fileUpload',
                status: j1.status
            }
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