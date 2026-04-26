import type { Metadata } from "next";
import { FileText } from "lucide-react";
import LegalPageShell, {
  H2,
  Li,
  P,
  Section,
  Strong,
  Ul,
} from "../_components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — GENESIS",
  description:
    "How GENESIS by Danyar Group handles paper URLs, simulation data, and user information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      eyebrow="Legal · Privacy"
      Icon={FileText}
      lastUpdated="April 26, 2026"
      sibling={{ label: "Terms of Service", href: "/terms" }}
    >
      <Section>
        <P>
          GENESIS by Danyar Group (<Strong>&ldquo;GENESIS&rdquo;</Strong>,{" "}
          <Strong>&ldquo;we&rdquo;</Strong>, <Strong>&ldquo;us&rdquo;</Strong>,{" "}
          <Strong>&ldquo;our&rdquo;</Strong>) treats user privacy as a
          first-class engineering concern, not an afterthought. This Privacy
          Policy explains what information we receive when you use the GENESIS
          service (the <Strong>&ldquo;Service&rdquo;</Strong>), how that
          information is used, and the rights you retain over it.
        </P>
        <P>
          By accessing or using the Service you agree to the practices
          described below. If you do not agree, please do not use the Service.
        </P>
      </Section>

      <Section>
        <H2>1. Information We Receive</H2>
        <P>
          GENESIS is designed to minimize data collection. The information we
          may handle falls into three narrow buckets:
        </P>
        <Ul>
          <Li>
            <Strong>Paper URLs and research queries you submit.</Strong> When
            you paste a paper link or type a natural-language research problem,
            our backend fetches the corresponding metadata (and, where
            available, full body text from the paper&apos;s host) to perform
            the requested simulation. These inputs are processed in memory for
            the duration of the request.
          </Li>
          <Li>
            <Strong>Generated simulation artifacts.</Strong> The Paper DNA,
            kernel code, and simulation parameters produced for your request
            may be cached locally on the server for short periods (typically
            minutes to days) solely to accelerate re-runs of the same paper
            and to power the Memory Bank&apos;s few-shot anchoring.
          </Li>
          <Li>
            <Strong>Standard server diagnostics.</Strong> Like virtually every
            web service, our infrastructure logs IP addresses, user-agent
            strings, and request timestamps for security monitoring and abuse
            prevention. These logs are rotated automatically.
          </Li>
        </Ul>
        <P>
          We do not collect names, email addresses, or other personal
          identifiers unless you voluntarily provide them through the optional
          &ldquo;Share Feedback&rdquo; form on the home page.
        </P>
      </Section>

      <Section>
        <H2>2. What We Do Not Do</H2>
        <Ul>
          <Li>
            We do not <Strong>sell, rent, or share</Strong> your submitted URLs
            or generated simulations with third parties for advertising,
            analytics, or any commercial purpose.
          </Li>
          <Li>
            We do not <Strong>permanently store</Strong> the content of papers
            you submit. We retrieve only what is needed to extract the
            algorithm, then keep a lightweight rolling cache that is purged on
            the schedule described in Section&nbsp;6.
          </Li>
          <Li>
            We do not build <Strong>profiles of individual users</Strong> for
            targeted advertising, behavioral retargeting, or third-party
            audience syndication.
          </Li>
          <Li>
            We do not embed <Strong>third-party advertising trackers</Strong>{" "}
            on the home page, the live dashboard, or any of the legal pages.
          </Li>
        </Ul>
      </Section>

      <Section>
        <H2>3. How We Use Information</H2>
        <P>
          The information we receive is used solely to:
        </P>
        <Ul>
          <Li>Operate, maintain, and improve the Service.</Li>
          <Li>
            Generate the Paper DNA, kernels, audits, debates, and syntheses
            you request via the underlying language-model API.
          </Li>
          <Li>
            Detect and prevent abuse, fraud, denial-of-service attempts, and
            other forms of service disruption.
          </Li>
          <Li>
            Respond to support requests or feedback you voluntarily submit.
          </Li>
        </Ul>
      </Section>

      <Section>
        <H2>4. Third-Party Services</H2>
        <P>
          GENESIS calls a small set of third-party APIs to perform its core
          function. Each receives only the minimum data necessary to fulfill
          the request you initiated. Their use of that data is governed by
          their own privacy policies, which we encourage you to review.
        </P>
        <Ul>
          <Li>
            <Strong>Anthropic</Strong> (Claude Opus 4.7) for paper extraction,
            debate, audit, discovery, frontier search, and synthesis.
          </Li>
          <Li>
            <Strong>arXiv</Strong> for paper metadata and HTML body retrieval.
          </Li>
          <Li>
            <Strong>OpenAlex</Strong> for closed-publisher fallback metadata
            and DOI-based abstract reconstruction.
          </Li>
          <Li>
            <Strong>NCBI / PubMed / PMC</Strong> for biomedical paper
            metadata and full-text JATS retrieval.
          </Li>
        </Ul>
      </Section>

      <Section>
        <H2>5. Data Retention</H2>
        <Ul>
          <Li>
            <Strong>Paper metadata caches:</Strong> rolling, typically up to
            thirty (30) days, after which entries are evicted automatically.
          </Li>
          <Li>
            <Strong>Generated simulations:</Strong> cached locally to
            accelerate re-runs; subject to the same rolling retention window
            and to capacity-based eviction.
          </Li>
          <Li>
            <Strong>Memory Bank exemplars:</Strong> we retain at most one
            hundred (100) lightweight summaries of past successful extractions
            for few-shot prompt anchoring. The oldest are evicted as new
            entries arrive.
          </Li>
          <Li>
            <Strong>Server diagnostic logs:</Strong> typically retained no
            longer than ninety (90) days.
          </Li>
        </Ul>
      </Section>

      <Section>
        <H2>6. Security</H2>
        <P>
          We use industry-standard transport encryption (HTTPS / TLS) for all
          traffic between your browser and our servers, and between our
          servers and the third-party APIs listed above. While we apply
          reasonable safeguards to protect the data we handle, no method of
          transmission or storage on the internet is one hundred percent
          secure, and we cannot guarantee absolute security.
        </P>
      </Section>

      <Section>
        <H2>7. Your Rights</H2>
        <P>
          Because GENESIS does not require accounts or persistent personal
          identifiers, we typically have no profile or login record to act
          upon. You may, however, request the deletion of any cached entry
          tied to a specific URL by contacting the address in Section&nbsp;11.
          We will honor such requests promptly and without conditions.
        </P>
        <P>
          If applicable law in your jurisdiction grants you additional rights
          (for example, the right to access, correct, port, or restrict
          processing of personal data under the GDPR or comparable
          regulations), you may exercise those rights by contacting us at the
          same address.
        </P>
      </Section>

      <Section>
        <H2>8. Children&apos;s Privacy</H2>
        <P>
          GENESIS is a research-oriented tool intended for university-age and
          professional users. The Service is not directed at children under
          the age of thirteen (13), and we do not knowingly collect personal
          information from children. If you believe a child has provided
          personal information to us, please contact us so we can delete it.
        </P>
      </Section>

      <Section>
        <H2>9. International Users</H2>
        <P>
          The servers operating GENESIS may be located in jurisdictions
          different from your own. By using the Service you understand that
          your inputs may be processed in those jurisdictions. We apply the
          same retention and security standards described in this policy
          regardless of where processing occurs.
        </P>
      </Section>

      <Section>
        <H2>10. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time as the Service
          evolves. The &ldquo;Last updated&rdquo; date at the top of this page
          reflects the most recent revision. Material changes will be
          highlighted on the home page or within the Service interface so you
          have a fair opportunity to review them before continued use.
        </P>
      </Section>

      <Section>
        <H2>11. Contact</H2>
        <P>
          For privacy questions, deletion requests, or other inquiries, please
          contact us at{" "}
          <Strong>privacy@danyargroup.example</Strong>. We aim to respond to
          all good-faith inquiries within a reasonable time.
        </P>
      </Section>
    </LegalPageShell>
  );
}
