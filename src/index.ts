import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'
import inquirer from 'inquirer'
import yaml from 'js-yaml'
import fs from 'fs'
import ResourceClient from './ResourceClient'

const configFname = './kachery-resource.yaml'
const config: Config | undefined = fs.existsSync(configFname) ?
                    (yaml.load(fs.readFileSync(configFname, 'utf-8')) as Config || undefined) : undefined

const main = () => {
    yargs(hideBin(process.argv))
        .command('init', 'Initialize the resource', yargs => {
            init()
        })
        .command('share', 'Share the resource', yargs => {
            share()
        })
        .parse()
}

export type Config = {
    resourceName: string
    kacheryZone: string
    maxConcurrentUploads?: number
    proxyUrl?: string
    proxySecret?: string
}

const init = async () => {
    const answers = await inquirer.prompt([
        {
            name: 'resourceName',
            message: 'Resource name',
            default: config?.resourceName
        },
        {
            name: 'kacheryZone',
            message: `Kachery zone$ (use . for default zone)`,
            default: config?.kacheryZone || '.'
        },
        {
            name: 'maxConcurrentUploads',
            message: `Maximum concurrent uploads`,
            default: config?.maxConcurrentUploads ? config?.maxConcurrentUploads : 2,
            type: 'number'
        },
        {
            name: 'proxyUrl',
            message: 'Proxy URL',
            default: config?.proxyUrl
        },
        {
            name: 'proxySecret',
            message: 'Proxy secret',
            default: config?.proxySecret,
            type: 'password'
        }
    ])
    if (answers.kacheryZone === '.')
        answers.kacheryZone = 'default'
    for (let k in answers) {
        if (answers[k]) {
            config[k] = answers[k]
        }
        else {
            config[k] = undefined
        }
    }
    fs.writeFileSync(configFname, yaml.dump(config))
    console.info(`Wrote ${configFname}`)
}

const share = async () => {
    if (!config) throw Error('No config')
    if (!config.kacheryZone) throw Error('No kachery zone in config.')
    if (config.kacheryZone !== (process.env.KACHERY_ZONE || 'default')) {
        throw Error(`Mismatch in kachery zone: ${config.kacheryZone} <> ${process.env.KACHERY_ZONE || 'default'}`)
    }
    const client = new ResourceClient(config)
    while (true) {
        await client.run()
        console.info('Disconnected. Will try again in 30 seconds.')
        await sleepMsec(1000 * 30)
    }
}

export const sleepMsec = async (msec: number) => {
    return new Promise<void>((resolve) => {setTimeout(() => {resolve()}, msec)})
}

main()