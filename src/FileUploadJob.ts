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
    constructor(private uri: string) {
    }
    async initialize() {
        const timestampRequested = Date.now()
        this.#fileInfo = await getKacheryFileInfo(this.uri)
        if (this.#fileInfo) {
            this.#status = {
                status: 'uploading',
                size: this.#fileInfo.size,
                bytesUploaded: 0,
                timestampRequested,
                timestampStarted: Date.now()
            }
            this._startUpload()
        }
        else {
            this.#status = {
                status: 'not-found'
            }
        }
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
                if (this.#status.status !== 'uploading') {
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
    async _startUpload() {
        const cmd = `kachery-cloud-store ${this.#fileInfo.path}`
        try {
            await execAsync(cmd)
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

const execAsync = (cmd: string) => {
    return new Promise<void>((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {}).on('exit', code => {
            if (code === 0) {
                resolve()
            }
            else {
                reject(new Error(`Command exited with code ${code}`))
            }
        })
    })
}

const getKacheryFilePath = (uri: string): string => {
    const a = uri.split('/')
    const sha1 = a[2]
    const kacheryCloudDir = process.env['KACHERY_CLOUD_DIR'] || `${os.homedir()}/.kachery-cloud`
    const s = sha1
    return `${kacheryCloudDir}/sha1/${s[0]}${s[1]}/${s[2]}${s[3]}/${s[4]}${s[5]}/${s}`
}

const getKacheryFileInfo = async (uri: string): Promise<KacheryFileInfo> => {
    const path = getKacheryFilePath(uri)
    let stat: fs.Stats
    try {
        stat = await fs.promises.stat(path)
    }
    catch(err) {
        return undefined
    }
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