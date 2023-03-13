import validateObject, { isEqualTo, isNumber, isOneOf, isString, optional } from "./validateObject"

// FileUpload

export type FileUploadRequest = {
    type: 'fileUpload'
    uri: string
    timeoutMsec: number
}

export const isFileUploadRequest = (x: any): x is FileUploadRequest => {
    return validateObject(x, {
        type: isEqualTo('fileUpload'),
        uri: isString,
        timeoutMsec: isNumber
    })
}

export type FileUploadStatus = {
    status: 'not-found' | 'queued' | 'running' | 'completed' | 'error'
    size?: number
    bytesUploaded?: number
    timestampRequested?: number
    timestampStarted?: number
    timestampCompleted?: number
    error?: string
}

export const isFileUploadStatus = (x: any): x is FileUploadStatus => {
    return validateObject(x, {
        status: isOneOf(['not-found', 'queued', 'running', 'completed', 'error'].map(a => isEqualTo(a))),
        size: optional(isNumber),
        bytesUploaded: optional(isNumber),
        timestampRequested: optional(isNumber),
        timestampStarted: optional(isNumber),
        timestampCompleted: optional(isNumber),
        error: optional(isString)
    })
}

export type FileUploadResponse = {
    type: 'fileUpload'
    status: FileUploadStatus
}

export const isFileUploadResponse = (x: any): x is FileUploadResponse => {
    return validateObject(x, {
        type: isEqualTo('fileUpload'),
        status: isFileUploadStatus
    })
}

///////////////////////////////////////////////////////////////////

export type KacheryResourceRequest = FileUploadRequest

export const isKacheryResourceRequest = isOneOf([
    isFileUploadRequest
])

export type KacheryResourceResponse = FileUploadResponse

export const isKacheryResourceResponse = isOneOf([
    isFileUploadResponse
])