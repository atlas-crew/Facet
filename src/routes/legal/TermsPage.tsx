import './legal.css'

export function TermsPage() {
  return (
    <article className="legal-page">
      <header className="legal-header">
        <h2>Terms of Service</h2>
        <p className="legal-meta">Effective Date: April 7, 2026 | Version 1.0</p>
      </header>

      <section>
        <h3>1. Acceptance of Terms</h3>
        <p>
          By creating an account or using Facet ("Service"), you agree to these Terms of Service
          ("Terms") and our <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use
          the Service. You must be at least 18 years old to use the Service.
        </p>
      </section>

      <section>
        <h3>2. Description of Service</h3>
        <p>
          Facet is a strategic resume assembly tool for professionals. The Service allows you to define
          career components, create positioning vectors, assemble targeted resumes, analyze job
          descriptions, generate cover letters, and produce other career materials. The Service
          includes both free features (resume assembly, pipeline tracking) and paid AI-powered
          features available through an AI Pro access pass.
        </p>
      </section>

      <section>
        <h3>3. Account Registration and Security</h3>
        <p>
          You authenticate through a third-party identity provider (currently GitHub via Supabase
          Auth). You are responsible for maintaining the security of your authentication credentials
          and for all activity that occurs under your account. Notify us immediately at{' '}
          <a href="mailto:support@myfacets.cv">support@myfacets.cv</a> if you suspect unauthorized
          access.
        </p>
      </section>

      <section>
        <h3>4. Acceptable Use</h3>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>
            Attempt to gain unauthorized access to any part of the Service or other users' data
          </li>
          <li>
            Upload malicious code, spam, or content that infringes on the rights of others
          </li>
          <li>
            Use the AI features to generate content that is misleading, fraudulent, or harmful
          </li>
          <li>
            Resell, sublicense, or redistribute the Service or its outputs without authorization
          </li>
          <li>
            Circumvent any access controls, rate limits, or security measures
          </li>
        </ul>
      </section>

      <section>
        <h3>5. Intellectual Property</h3>
        <p>
          The Facet software is licensed under the GNU Affero General Public License (AGPL). The
          source code is available at{' '}
          <a href="https://github.com/atlas-crew/Facet" target="_blank" rel="noopener noreferrer">
            github.com/atlas-crew/Facet
          </a>
          . The Facet name, logo, and brand elements are the property of Nicholas Crew Ferguson and
          are not covered by the AGPL license.
        </p>
        <p>
          You retain full ownership of all content you create, upload, or generate using the Service,
          including resumes, cover letters, and career materials. We claim no intellectual property
          rights over your content. We store and process your content solely to provide the Service
          to you.
        </p>
      </section>

      <section>
        <h3>6. AI Pro Access and Payment</h3>
        <p>
          AI-powered features require an AI Pro access pass. Each pass grants 90 days of access to
          all AI features from the date of purchase, for a one-time payment of $49 USD. Access passes
          are non-recurring; you will not be charged again unless you make another purchase. If you
          purchase an additional pass while your current pass is active, the new 90-day period is
          added to your existing expiry date.
        </p>
        <p>
          Payments are processed by Stripe. We do not store your payment card details. All sales are
          final. Refund requests may be considered on a case-by-case basis within 7 days of purchase
          by contacting <a href="mailto:support@myfacets.cv">support@myfacets.cv</a>.
        </p>
        <p>
          We reserve the right to change pricing for future purchases with 30 days' notice. Price
          changes do not affect passes already purchased.
        </p>
      </section>

      <section>
        <h3>7. Self-Hosted Use</h3>
        <p>
          Facet may also be run as a self-hosted application under the terms of the AGPL license. The
          self-hosted version does not require an account, does not transmit data to our servers, and
          is not covered by these Terms beyond the AGPL license obligations. These Terms govern only
          the hosted Service at its published URLs.
        </p>
      </section>

      <section>
        <h3>8. Disclaimer of Warranties</h3>
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
          EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
          OR SECURE. AI-GENERATED CONTENT MAY CONTAIN INACCURACIES AND SHOULD BE REVIEWED BEFORE
          USE. WE MAKE NO REPRESENTATIONS ABOUT THE SUITABILITY OF AI-GENERATED CONTENT FOR ANY
          PARTICULAR PURPOSE, INCLUDING EMPLOYMENT APPLICATIONS.
        </p>
      </section>

      <section>
        <h3>9. Limitation of Liability</h3>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM
          THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID FOR AI PRO
          ACCESS IN THE 12 MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL WE BE LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF EMPLOYMENT OPPORTUNITIES,
          LOST PROFITS, OR LOSS OF DATA.
        </p>
      </section>

      <section>
        <h3>10. Indemnification</h3>
        <p>
          You agree to indemnify and hold harmless Nicholas Crew Ferguson and any affiliates from any
          claims, damages, or expenses arising from your use of the Service, your content, or your
          violation of these Terms.
        </p>
      </section>

      <section>
        <h3>11. Termination</h3>
        <p>
          You may stop using the Service at any time. We may suspend or terminate your access if you
          violate these Terms. Upon termination, you may export your data using the Service's built-in
          export features. We will retain your data for 30 days after termination to allow for
          export, after which it may be deleted.
        </p>
      </section>

      <section>
        <h3>12. Dispute Resolution</h3>
        <p>
          These Terms are governed by the laws of the State of Colorado, United States. Any disputes
          shall be resolved through good-faith negotiation. If negotiation fails, disputes shall be
          submitted to binding arbitration under the rules of the American Arbitration Association,
          conducted remotely or in Denver, Colorado. You waive the right to participate in
          class-action proceedings.
        </p>
      </section>

      <section>
        <h3>13. Changes to Terms</h3>
        <p>
          We may update these Terms from time to time. We will notify you of material changes by
          posting a notice within the Service or by email. Continued use of the Service after the
          effective date of changes constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section>
        <h3>14. Contact</h3>
        <p>
          Nicholas Crew Ferguson
          <br />
          <a href="mailto:support@myfacets.cv">support@myfacets.cv</a>
          <br />
          <a href="https://github.com/atlas-crew/Facet" target="_blank" rel="noopener noreferrer">
            github.com/atlas-crew/Facet
          </a>
        </p>
      </section>
    </article>
  )
}
