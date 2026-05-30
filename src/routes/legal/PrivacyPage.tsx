import './legal.css'

export function PrivacyPage() {
  return (
    <article className="legal-page">
      <header className="legal-header">
        <h2>Privacy Policy</h2>
        <p className="legal-meta">Effective Date: April 7, 2026 | Version 1.0</p>
      </header>

      <section>
        <h3>1. Information We Collect</h3>
        <table className="legal-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Examples</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Account data</td>
              <td>Email address, GitHub username and profile ID</td>
              <td>Authentication and account identification</td>
            </tr>
            <tr>
              <td>Career content</td>
              <td>
                Resume data, work history, skills, education, job descriptions, cover letters,
                interview notes
              </td>
              <td>Core service functionality</td>
            </tr>
            <tr>
              <td>AI interaction data</td>
              <td>Prompts sent to AI features, generated outputs</td>
              <td>AI feature delivery</td>
            </tr>
            <tr>
              <td>Payment data</td>
              <td>Stripe customer ID, purchase history</td>
              <td>Payment processing and entitlement management</td>
            </tr>
            <tr>
              <td>Usage data</td>
              <td>Feature usage, session timing, error logs</td>
              <td>Service improvement and debugging</td>
            </tr>
          </tbody>
        </table>
        <p>
          We do not collect your payment card number, CVV, or billing address. Payment card data is
          handled entirely by Stripe and never touches our servers.
        </p>
      </section>

      <section>
        <h3>2. How We Use Your Information</h3>
        <ul>
          <li>
            <strong>Service delivery:</strong> Storing and syncing your workspace data, processing AI
            requests, managing your access pass
          </li>
          <li>
            <strong>AI processing:</strong> Your prompts and career content are sent to Anthropic's
            Claude API to generate analysis, suggestions, and written materials. We send only the
            data necessary for each specific AI request.
          </li>
          <li>
            <strong>Service improvement:</strong> Aggregate, anonymized usage patterns to improve
            features
          </li>
          <li>
            <strong>Communication:</strong> Service-related notices (not marketing)
          </li>
          <li>
            <strong>Legal compliance:</strong> Responding to lawful requests from authorities
          </li>
        </ul>
      </section>

      <section>
        <h3>3. Service Providers</h3>
        <p>
          We share data with the following service providers, solely to operate the Service. We do
          not sell your personal information.
        </p>
        <table className="legal-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Data shared</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Authentication and database hosting</td>
              <td>Account data, workspace data</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>AI features (Claude API)</td>
              <td>Prompts and career content for AI processing</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payment processing</td>
              <td>Email, Stripe customer ID</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Frontend hosting</td>
              <td>Standard web request data (IP, user agent)</td>
            </tr>
            <tr>
              <td>Fly.io</td>
              <td>API server hosting</td>
              <td>Standard web request data</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h3>4. AI Data Processing</h3>
        <p>
          When you use AI-powered features, portions of your career content (such as resume bullets,
          job descriptions, or interview notes) are sent to Anthropic's Claude API for processing.
          Anthropic's data usage policies apply to this processing. As of the effective date of this
          policy, Anthropic does not use API inputs or outputs to train its models. We encourage you
          to review{' '}
          <a
            href="https://www.anthropic.com/policies/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Anthropic's privacy policy
          </a>{' '}
          for current terms.
        </p>
        <p>
          We do not store AI conversation logs beyond the data you explicitly save as workspace
          content (such as generated cover letters or analysis results).
        </p>
      </section>

      <section>
        <h3>5. Data Retention</h3>
        <ul>
          <li>
            <strong>Active accounts:</strong> Your data is retained for as long as your account is
            active.
          </li>
          <li>
            <strong>After termination:</strong> Data is retained for 30 days to allow export, then
            deleted.
          </li>
          <li>
            <strong>Payment records:</strong> Transaction records are retained for 7 years for tax
            and legal compliance.
          </li>
          <li>
            <strong>Anonymized analytics:</strong> Aggregate usage data may be retained indefinitely.
          </li>
        </ul>
      </section>

      <section>
        <h3>6. Data Security</h3>
        <p>
          We use industry-standard security measures including encrypted connections (TLS),
          authenticated API access (JWT), and database-level access controls. Workspace data is
          stored in a managed PostgreSQL database with automated backups. Authentication is handled
          by Supabase Auth using OAuth 2.0 with PKCE.
        </p>
        <p>
          No system is perfectly secure. If we discover a data breach affecting your personal
          information, we will notify you within 72 hours.
        </p>
      </section>

      <section>
        <h3>7. Your Rights</h3>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access:</strong> Access and download supported workspace data through built-in
            export tools, and request a full copy of your personal data by contacting support
          </li>
          <li>
            <strong>Correction:</strong> Edit your career content at any time through the Service
          </li>
          <li>
            <strong>Deletion:</strong> Request deletion of your account and all associated data by
            contacting us
          </li>
          <li>
            <strong>Portability:</strong> Download supported workspace data through built-in export
            tools where available. Export formats are typically JSON or YAML and vary by
            workspace; contact support for a full data copy.
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact{' '}
          <a href="mailto:support@myfacets.cv">support@myfacets.cv</a>.
        </p>
      </section>

      <section>
        <h3>8. GDPR (EU/EEA Users)</h3>
        <p>
          If you are located in the European Economic Area, our legal basis for processing your data
          is:
        </p>
        <ul>
          <li>
            <strong>Contract performance:</strong> Account data and workspace data necessary to
            provide the Service
          </li>
          <li>
            <strong>Legitimate interest:</strong> Usage analytics for service improvement
          </li>
          <li>
            <strong>Consent:</strong> AI processing of your career content (you initiate each AI
            request)
          </li>
        </ul>
        <p>
          You additionally have the right to restrict processing, object to processing, and lodge a
          complaint with your local data protection authority. Data may be transferred to and
          processed in the United States where our service providers operate.
        </p>
      </section>

      <section>
        <h3>9. CCPA (California Users)</h3>
        <p>
          California residents have the right to know what personal information we collect, request
          deletion, and opt out of the sale of personal information. We do not sell personal
          information. To exercise your rights, contact{' '}
          <a href="mailto:support@myfacets.cv">support@myfacets.cv</a>.
        </p>
      </section>

      <section>
        <h3>10. Children's Privacy</h3>
        <p>
          The Service is not directed to anyone under 18. We do not knowingly collect personal
          information from children. If you believe we have collected data from a minor, contact us
          and we will delete it promptly.
        </p>
      </section>

      <section>
        <h3>11. Cookies</h3>
        <p>
          The Service uses essential cookies and local storage for authentication session management
          and user preferences (such as theme selection). We do not use advertising or tracking
          cookies. No cookie consent banner is required as we only use strictly necessary cookies.
        </p>
      </section>

      <section>
        <h3>12. Changes to This Policy</h3>
        <p>
          We may update this policy from time to time. We will notify you of material changes by
          posting a notice within the Service. The effective date at the top of this page indicates
          when the policy was last revised.
        </p>
      </section>

      <section>
        <h3>13. Contact</h3>
        <p>
          For privacy-related questions or to exercise your data rights:
          <br />
          Nicholas Crew Ferguson
          <br />
          <a href="mailto:support@myfacets.cv">support@myfacets.cv</a>
        </p>
      </section>
    </article>
  )
}
