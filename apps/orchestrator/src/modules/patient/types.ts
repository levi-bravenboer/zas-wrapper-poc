import type { components } from '@/lib/api/schema'

export type PatientRow = components['schemas']['PatientRead']
export type PatientIdentifierRow = components['schemas']['PatientIdentifierRead']
export type PatientGender = components['schemas']['Gender']
export type PatientSource = components['schemas']['PatientSource']
export type OrganisationOption = components['schemas']['OrganisationRead']
export type PatientUpdatePayload = components['schemas']['PatientUpdate']
export type CareTeamRow = components['schemas']['CareTeamRead']
export type LusciiPatientData = components['schemas']['LusciiPatientData']
export type LusciiLinkResult = components['schemas']['LusciiLinkResult']
export type LusciiPlannedAction = components['schemas']['LusciiPlannedActionView']
export type LusciiMeasurement = components['schemas']['LusciiMeasurementView']
export type LusciiMeasurementValue = components['schemas']['LusciiMeasurementValueView']
