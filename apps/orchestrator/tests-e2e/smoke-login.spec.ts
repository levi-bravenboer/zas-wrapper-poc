import { expect, test } from '@playwright/test'

test('user can log in and see the authed landing', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/gebruikersnaam/i).fill('demo')
  await page.getByLabel(/wachtwoord/i).fill('demo')
  await page.getByRole('button', { name: /inloggen/i }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: /welkom/i })).toBeVisible()
})
