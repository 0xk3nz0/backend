import type { FastifyInstance } from "fastify";



export const registeredPlugins: string[] = [];

export default (instance: FastifyInstance, opts: any) => {
    if (opts && opts.name) {
        registeredPlugins.push(opts.name);
        instance.log.info(`Registered plugin: ${opts.name}`);
    } else {
        instance.log.info('Registered unnamed plugin');
    }
}

