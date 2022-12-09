import { FileUploadStatus } from "./KacheryResourceRequest"
import os from 'os'
import fs from 'fs'
import { exec } from "child_process"

type KacheryFileInfo = {
    path: string
    size: number
}

class FileUploadJob {
    #isRunning = false
    #status: FileUploadStatus
    #fileInfo: KacheryFileInfo | undefined
    #statusChangeCallbacks: {[id: string]: () => void} = {}
    #timestampCreated: number
    #cancelSignaller: {onCancel?: () => void} = {}
    #requestId?: string
    constructor(private uri: string) {
        this.#timestampCreated = Date.now()
    }
    async initialize() {
        const timestampRequested = Date.now()
        this.#fileInfo = await getKacheryFileInfo(this.uri)
        if (this.#fileInfo) {
            this.#status = {
                status: 'queued',
                size: this.#fileInfo.size,
                bytesUploaded: 0,
                timestampRequested
            }
        }
        else {
            this.#status = {
                status: 'not-found'
            }
        }
    }
    startUpload() {
        this._startUpload()
    }
    setRequestId(r: string) {
        this.#requestId = r
    }
    public get requestId() {
        return this.#requestId
    }
    public get timestampCreated() {
        return this.#timestampCreated
    }
    public get isRunning() {
        return this.#isRunning
    }
    public get status() {
        return this.#status
    }
    async waitForCompleted(timeoutMsec: number) {
        return new Promise<void>((resolve) => {
            let finished = false
            const cancelCallback = this.onStatusChange(() => {
                if (this.#status.status !== 'running') {
                    if (!finished) {
                        finished = true
                        cancelCallback()
                        resolve()
                    }
                }
            })
            setTimeout(() => {
                if (!finished) {
                    finished = true
                    cancelCallback()
                    resolve()
                }
            }, timeoutMsec)
        })
    }
    onStatusChange(callback: () => void) {
        const id = randomAlphaString(10)
        this.#statusChangeCallbacks[id] = callback
        return () => {
            delete this.#statusChangeCallbacks[id]
        }
    }
    cancel() {
        if ((this.status.status === 'running') || (this.status.status === 'queued')) {
            console.info('Canceling file upload job.')
            this._updateStatus({
                status: 'error',
                error: 'canceled'
            })
            if (this.#cancelSignaller.onCancel) {
                this.#cancelSignaller.onCancel() // calls kill on the process
            }
        }
    }
    async _startUpload() {
        const cmd = `kachery-cloud-store ${this.#fileInfo.path}`
        this._updateStatus({
            status: 'running',
            timestampStarted: Date.now()
        })
        try {
            await execAsync(cmd, this.#cancelSignaller)
        }
        catch(err) {
            this._updateStatus({
                status: 'error',
                error: `Error executing kachery-cloud-store: ${err.message}`
            })
            return
        }
        this._updateStatus({
            status: 'completed',
            bytesUploaded: this.#fileInfo.size,
            timestampCompleted: Date.now()
        })
    }
    _updateStatus(status: FileUploadStatus) {
        this._setStatus({
            ...this.#status,
            ...status
        })
    }
    _setStatus(status: FileUploadStatus) {
        this.#status = status
        for (let id in this.#statusChangeCallbacks) {
            this.#statusChangeCallbacks[id]()
        }
    }
}

const execAsync = (cmd: string, cancelSignaller: {onCancel?: () => void}) => {
    return new Promise<void>((resolve, reject) => {
        const process = exec(cmd, (error, stdout, stderr) => {}).on('exit', code => {
            if (code === 0) {
                resolve()
            }
            else {
                reject(new Error(`Command exited with code ${code}`))
            }
        })
        cancelSignaller.onCancel = () => {
            process.kill() // sends SIGTERM by default. Is this what we want? (@jsoules)   
        }
    })
}

const getKacheryFilePath = (uri: string): string => {
    const a = uri.split('/')
    const sha1 = a[2]
    const kacheryCloudDir = process.env['KACHERY_CLOUD_DIR'] || `${os.homedir()}/.kachery-cloud`
    const s = sha1
    return `${kacheryCloudDir}/sha1/${s[0]}${s[1]}/${s[2]}${s[3]}/${s[4]}${s[5]}/${s}`
}

const getKacheryFileInfo = async (uri: string): Promise<KacheryFileInfo | undefined> => {
    const path = getKacheryFilePath(uri)
    let stat: fs.Stats
    try {
        stat = await fs.promises.stat(path)
    }
    catch(err) {
        return await getKacheryLinkFileInfo(uri)
    }
    return {
        path,
        size: stat.size
    }
}

const getKacheryFileLinkPath = (uri: string): string => {
    const a = uri.split('/')
    const sha1 = a[2]
    const kacheryCloudDir = process.env['KACHERY_CLOUD_DIR'] || `${os.homedir()}/.kachery-cloud`
    const s = sha1
    return `${kacheryCloudDir}/linked_files/sha1/${s[0]}${s[1]}/${s[2]}${s[3]}/${s[4]}${s[5]}/${s}`
}

const getKacheryLinkFileInfo = async (uri: string): Promise<KacheryFileInfo | undefined> => {
    const linkPath = getKacheryFileLinkPath(uri)
    if (!fs.existsSync(linkPath)) {
        return undefined
    }
    const a = await fs.promises.readFile(linkPath, 'utf-8')
    const {path, size, mtime} = JSON.parse(a)
    if (!fs.existsSync(path)) {
        return undefined
    }
    let stat: fs.Stats
    try {
        stat = await fs.promises.stat(path)
    }
    catch(err) {
        return undefined
    }
    if (stat.size !== size) {
        return undefined
    }
    // We won't check the mtime here, even though perhaps we should
    return {
        path,
        size: stat.size
    }
}


export const randomAlphaString = (num_chars: number) => {
    if (!num_chars) {
        /* istanbul ignore next */
        throw Error('randomAlphaString: num_chars needs to be a positive integer.')
    }
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for (var i = 0; i < num_chars; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

export default FileUploadJob