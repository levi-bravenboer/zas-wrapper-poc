import { expect, test } from '@playwright/test'

const EMAIL = 'caregiver@zas.local'
const PASSWORD = 'changeme'

test('happy path: redirect-aware login lands on / and reflects session', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login\?redirect=%2F/)

  // Discovery happens before inputs render — wait for the email input.
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()

  await page.getByLabel(/E-mailadres/i).fill(EMAIL)
  await page.getByLabel(/Wachtwoord/i).fill(PASSWORD)
  await page.getByRole('button', { name: /Inloggen/i }).click()

  await expect(page).toHaveURL('/')
})

test('bad credentials show invalid_credentials and keep the user on /login', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()
  await page.getByLabel(/E-mailadres/i).fill(EMAIL)
  await page.getByLabel(/Wachtwoord/i).fill('nope')
  await page.getByRole('button', { name: /Inloggen/i }).click()

  await expect(page.getByText(/Ongeldige inloggegevens/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('redirect query is honoured after a successful login', async ({ page }) => {
  await page.goto('/login?redirect=/patients')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()
  await page.getByLabel(/E-mailadres/i).fill(EMAIL)
  await page.getByLabel(/Wachtwoord/i).fill(PASSWORD)
  await page.getByRole('button', { name: /Inloggen/i }).click()

  await expect(page).toHaveURL('/patients')
})

test('logout returns the user to /login and clears the session', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()
  await page.getByLabel(/E-mailadres/i).fill(EMAIL)
  await page.getByLabel(/Wachtwoord/i).fill(PASSWORD)
  await page.getByRole('button', { name: /Inloggen/i }).click()
  await expect(page).toHaveURL('/')

  // Open user menu (sidebar footer trigger), then click the Uitloggen item.
  await page.getByRole('button', { name: /Demo Caregiver/ }).click()
  await page.getByRole('menuitem', { name: /Uitloggen/i }).click()
  await expect(page).toHaveURL(/\/login/)

  // Run fetch inside the page so MSW (browser-side) intercepts in mock mode.
  const meStatus = await page.evaluate(async () => {
    const res = await fetch('http://localhost:18000/auth/me', { credentials: 'include' })
    return res.status
  })
  expect(meStatus).toBe(401)
})

test('discovery loads before the inputs render (no flash of blank form)', async ({ page }) => {
  let providersResolved = false
  page.on('response', (response) => {
    if (response.url().endsWith('/auth/providers') && response.ok()) {
      providersResolved = true
    }
  })

  await page.goto('/login')
  await expect(page.getByLabel(/E-mailadres/i)).toBeVisible()
  expect(providersResolved).toBe(true)
})
