import { expect, test } from '@playwright/test'

const MULTI_EMAIL = 'hoofdarts@zas.local'
const PASSWORD = 'changeme'

test('multi-role login shows the role picker, binds, and lands on the redirect', async ({
  page,
}) => {
  await page.goto('/login?redirect=/patients')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()

  await page.getByLabel(/E-mailadres/i).fill(MULTI_EMAIL)
  await page.getByLabel(/Wachtwoord/i).fill(PASSWORD)
  await page.getByRole('button', { name: /Inloggen/i }).click()

  // session is live but unbound — the picker replaces the form
  await expect(page.getByRole('heading', { name: /Kies je rol/i })).toBeVisible()
  await page.getByRole('button', { name: /Beheerder/i }).click()

  await expect(page).toHaveURL('/patients')
})

test('mid-session role switch via the user menu, no re-login', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()
  await page.getByLabel(/E-mailadres/i).fill(MULTI_EMAIL)
  await page.getByLabel(/Wachtwoord/i).fill(PASSWORD)
  await page.getByRole('button', { name: /Inloggen/i }).click()
  await page.getByRole('button', { name: /Zorgverlener/i }).click()
  await expect(page).toHaveURL('/')

  await page.getByRole('button', { name: /Hilde Hoofdarts/ }).click()
  await page.getByRole('menuitem', { name: /Wissel naar Beheerder/i }).click()

  // user menu reflects the new active role without a trip through /login
  await expect(page.getByRole('button', { name: /Hilde Hoofdarts/ })).toContainText('admin')
})

test('single-role login never sees the picker', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()
  await page.getByLabel(/E-mailadres/i).fill('caregiver@zas.local')
  await page.getByLabel(/Wachtwoord/i).fill(PASSWORD)
  await page.getByRole('button', { name: /Inloggen/i }).click()
  await expect(page).toHaveURL('/')
})
