import validateObject, { isEqualTo, isNumber, isString, optional } from "./validateObject"

export type RequestFromClient = {
    type: 'requestFromClient'
    resourceName: string
    request: any
    timeoutMsec: number
    requestId?: string // added when sending over websocket
}

export const isRequestFromClient = (x: any): x is RequestFromClient => {
    return validateObject(x, {
        type: isEqualTo('requestFromClient'),
        resourceName: isString,
        request: () => (true),
        timeoutMsec: isNumber,
        requestId: optional(isString)
    })
}

export type ResponseToClient = {
    type: 'responseToClient'
    requestId?: string // added when sending over websocket
    response: any
    error?: string
}

export const isResponseToClient = (x: any): x is ResponseToClient => {
    return validateObject(x, {
        type: isEqualTo('responseToClient'),
        response: () => (true),
        requestId: optional(isString),
        error: optional(isString)
    })
}

export type InitializeMessageFromResource = {
    type: 'initialize'
    resourceName: string
    proxySecret: string
}

export const isInitializeMessageFromResource = (x: any): x is InitializeMessageFromResource => {
    return validateObject(x, {
        type: isEqualTo('initialize'),
        resourceName: isString,
        proxySecret: isString
    })
}

// to keep alive
export type PingMessageFromResource = {
    type: 'ping'
}

export type AcknowledgeMessageToResource = {
    type: 'acknowledge'
}

export const isAcknowledgeMessageToResource = (x: any): x is AcknowledgeMessageToResource => {
    return validateObject(x, {
        type: isEqualTo('acknowledge')
    })
}

export type CancelRequestFromClientMessage = {
    type: 'cancelRequestFromClient'
    requestId: string
}

export const isCancelRequestFromClientMessage = (x: any): x is CancelRequestFromClientMessage => {
    return validateObject(x, {
        type: isEqualTo('cancelRequestFromClient'),
        requestId: isString
    })
}

