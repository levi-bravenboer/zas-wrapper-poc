// Fixture: raw <table> outside the Table primitive / DataTable internals.
// Must trigger `no-restricted-syntax` from eslint.config.js (§26.1).
export function RawTable() {
  return (
    <table>
      <tbody>
        <tr>
          <td>nope</td>
        </tr>
      </tbody>
    </table>
  )
}
