export type PatientSession = {
  id: string
  given_name: string
  patient_id: string
  tenant_id: string
}

export type LoginInput = {
  tenant: string
  email: string
  password: string
}
