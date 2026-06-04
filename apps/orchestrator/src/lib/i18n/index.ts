import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import auth from './locales/nl/auth.json'
import careTeamsUi from './locales/nl/care-teams-ui.json'
import caregiverShell from './locales/nl/caregiver-shell.json'
import common from './locales/nl/common.json'
import dashboard from './locales/nl/dashboard.json'
import dataTable from './locales/nl/data-table.json'
import entityPage from './locales/nl/entity-page.json'
import nav from './locales/nl/nav.json'
import organisationsAdminUi from './locales/nl/organisations-admin-ui.json'
import pathway from './locales/nl/pathway.json'
import patientProfile from './locales/nl/patient-profile.json'
import patients from './locales/nl/patients.json'
import practitionerRolesAdminUi from './locales/nl/practitioner-roles-admin-ui.json'
import shell from './locales/nl/shell.json'
import smart from './locales/nl/smart.json'
import usersAdminUi from './locales/nl/users-admin-ui.json'
import users from './locales/nl/users.json'

export const SUPPORTED_LOCALES = ['nl', 'fr', 'en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'nl'

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

void i18next.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  ns: [
    'common',
    'auth',
    'care-teams-ui',
    'caregiver-shell',
    'dashboard',
    'data-table',
    'entity-page',
    'nav',
    'organisations-admin-ui',
    'pathway',
    'patient-profile',
    'patients',
    'practitioner-roles-admin-ui',
    'shell',
    'smart',
    'users',
    'users-admin-ui',
  ],
  resources: {
    nl: {
      common,
      auth,
      'care-teams-ui': careTeamsUi,
      'caregiver-shell': caregiverShell,
      dashboard,
      'data-table': dataTable,
      'entity-page': entityPage,
      nav,
      'organisations-admin-ui': organisationsAdminUi,
      pathway,
      'patient-profile': patientProfile,
      patients,
      'practitioner-roles-admin-ui': practitionerRolesAdminUi,
      shell,
      smart,
      users,
      'users-admin-ui': usersAdminUi,
    },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
})

export const i18n = i18next
