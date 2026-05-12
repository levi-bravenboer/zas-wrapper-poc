import { expect, test } from '@playwright/test'

test('user can log in and lands on the dashboard with the sidebar visible', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/gebruikersnaam/i).fill('demo')
  await page.getByLabel(/wachtwoord/i).fill('demo')
  await page.getByRole('button', { name: /inloggen/i }).click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('navigation', { name: 'primary' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
