import type { components } from '@/lib/api/schema'

export type Enrollment = components['schemas']['EnrollmentResponse']
export type EnrollmentCreate = components['schemas']['EnrollmentCreate']
export type BlockExecution = components['schemas']['BlockExecutionResponse']
export type EnrollmentState = Enrollment['state']
export type BlockExecutionState = BlockExecution['state']
export type EnrollDescriptor = components['schemas']['EnrollDescriptor']
export type EnrollDescriptorField = components['schemas']['EnrollDescriptorField']
