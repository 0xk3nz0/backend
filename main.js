// const z = require('zod');
import { z } from 'zod'
const schema = z.object({ uuid: z.string().email() });
try {
  schema.parse({ uuid: 'foo@example.com' });
  schema.parse({ uuid: 'foo@example.com' });
} catch(err) {
  console.log('[EMAIL] This should not happen', err);
}

const schemaUUID = z.object({ uuid: z.string().uuid() });
try {
  schemaUUID.parse({ uuid: '1a657d0c-b676-4bbf-9d18-d9ecb8547d8d' });
  schemaUUID.parse({ uuid: '1a657d0c-b676-4bbf-9d18-d9ecb8547d8d' });
} catch(err) {
  console.log('[UUID] This should not happen', err);
}
