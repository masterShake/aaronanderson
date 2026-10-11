import './globals.css'
import { fontVariables } from './fonts'

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-US" className={fontVariables}>
      <body>{children}</body>
    </html>
  )
}
