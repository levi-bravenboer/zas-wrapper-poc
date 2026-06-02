import { Text } from 'react-native'

import { renderWithProviders } from '../utils/render-with-providers'

describe('root scaffold smoke test', () => {
  it('renders a child wrapped in providers without throwing', () => {
    const { getByText } = renderWithProviders(<Text>scaffold</Text>)
    expect(getByText('scaffold')).toBeTruthy()
  })
})
