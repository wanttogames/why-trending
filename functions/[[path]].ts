export const onRequestGet = async (context: { next(): Promise<Response> }): Promise<Response> => context.next()
