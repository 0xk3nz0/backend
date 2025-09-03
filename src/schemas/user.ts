export const userRegisterSchema = {
    body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
            name: {
                type: 'string',
                minLength: 3
            },
            email: {
                type: 'string',
                format: 'email'
            },
            password: {
                type: 'string',
                minLength: 8,
                // pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$'
                // ✅ at least 8 chars, one letter, one number
            }
        }
    },
    response: {
        201: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        createdAt: { type: 'string' }
                    }
                },
                token: { type: 'string' }
            }
        }
    }
}


// import { z } from 'zod';

// export const registrationSchema = z.object({
//     username: z.string().min(3),
//     email: z.string().email(),
//     password: z.string().min(8)
// })

// export type RegisterBody = z.infer<typeof registrationSchema>;

// import fastify from "fastify";


// fastify.post('/posts/:postId', {
//   schema: {
//     // 1. Validate request body
//     body: {
//       type: 'object',
//       required: ['title', 'content'],
//       properties: {
//         title: { type: 'string' },
//         content: { type: 'string' }
//       }
//     },
    
//     // 2. Validate URL parameters
//     params: {
//       type: 'object',
//       required: ['postId'],
//       properties: {
//         postId: { type: 'integer' }
//       }
//     },
    
//     // 3. Validate query string
//     querystring: {
//       type: 'object',
//       required: ['published'],
//       properties: {
//         published: { type: 'boolean' }
//       }
//     },
    
//     // 4. Validate headers
//     headers: {
//       type: 'object',
//       required: ['x-api-key'],
//       properties: {
//         'x-api-key': { type: 'string' }
//       }
//     },

//     // 5. Serialize the response
//     response: {
//       201: {
//         type: 'object',
//         properties: {
//           id: { type: 'integer' },
//           message: { type: 'string' }
//         }
//       },
//       400: {
//         type: 'object',
//         properties: {
//           error: { type: 'string' }
//         }
//       }
//     }
//   }
// }, async (request, reply) => {
//   // If the request passes all schema validations, this handler runs.
//   const { title, content } = request.body
//   const { postId } = request.params
//   const { published } = request.query
//   const { 'x-api-key': apiKey } = request.headers

//   if (apiKey !== 'my-secret-key') {
//     reply.code(401).send({ error: 'Unauthorized' })
//     return
//   }
  
//   // Here, you would save the data to a database.
//   reply.code(201).send({ id: postId, message: 'Post created successfully' })
// })

// const start = async () => {
//   try {
//     await fastify.listen({ port: 3000 })
//   } catch (err) {
//     fastify.log.error(err)
//     process.exit(1)
//   }
// }

// start()




export const userLoginSchema = {
    body: {
        type: 'object',
        properties: {
            email: { type: 'string' },
            password: { type: 'string' },
        }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                uid: { type: 'string' },
                message: { type: 'string' }
            }
        },
        404: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                message: { type: 'string' }
            }
        },
        401: {
            type: 'object',
            properties: {
                statusCode: { type: 'number' },
                message: { type: 'string' }
            }
        }
    }
};
