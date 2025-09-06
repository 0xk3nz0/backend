


// User creation schema
export const userRegisterSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z]+$',
        errorMessage: {
          type: 'Name must be a string',
          minLength: 'Name must be at least 3 characters long',
          maxLength: 'Name cannot exceed 30 characters',
          pattern: 'Name can only contain letters'
        }
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        errorMessage: {
          type: 'Email must be a string',
          format: 'Invalid email address',
          maxLength: 'Email cannot exceed 255 characters'
        }
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 30,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
        errorMessage: {
          type: 'Password must be a string',
          minLength: 'Password must be at least 8 characters long',
          maxLength: 'Password cannot exceed 30 characters',
          pattern: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
        }
      }
    },
    errorMessage: {
      required: {
        name: 'Name is required',
        email: 'Email is required',
        password: 'Password is required'
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
};


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
