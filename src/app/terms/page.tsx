import type { Metadata } from "next";
import { Scale } from "lucide-react";
import LegalPageShell, {
  Disclaimer,
  H2,
  Li,
  P,
  Section,
  Strong,
  Ul,
} from "../_components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service — GENESIS",
  description:
    "Terms governing use of GENESIS by Danyar Group, an AI-powered scientific simulation tool.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      eyebrow="Legal · Terms"
      Icon={Scale}
      lastUpdated="April 26, 2026"
      sibling={{ label: "Privacy Policy", href: "/privacy" }}
    >
      <Section>
        <P>
          These Terms of Service (the <Strong>&ldquo;Terms&rdquo;</Strong>)
          govern your access to and use of GENESIS, an AI-powered scientific
          simulation tool operated by Danyar Group (
          <Strong>&ldquo;GENESIS&rdquo;</Strong>,{" "}
          <Strong>&ldquo;we&rdquo;</Strong>, <Strong>&ldquo;us&rdquo;</Strong>,{" "}
          <Strong>&ldquo;our&rdquo;</Strong>). By accessing or using the
          Service you agree to be bound by these Terms. If you do not agree,
          please do not use the Service.
        </P>
      </Section>

      <Section>
        <H2>1. The Service</H2>
        <P>
          GENESIS converts research papers into interactive simulations using
          large language models, primarily Anthropic&apos;s Claude Opus 4.7.
          The Service includes core extraction, multi-paper synthesis
          (Multiverse), agentic audit, autonomous discovery, AI debate, and
          natural-language frontier search.
        </P>
        <P>
          The Service is provided for{" "}
          <Strong>
            educational, exploratory, and generative research purposes only
          </Strong>
          . It is <Strong>not</Strong> a clinical, regulatory, financial,
          safety-critical, or production-engineering tool. Outputs are
          intended to help you understand, prototype, and reason about
          algorithms — not to drive decisions where real-world harm could
          result from a flawed simulation.
        </P>
      </Section>

      <Section>
        <H2>2. &ldquo;As Is&rdquo; Provision</H2>
        <Disclaimer>
          The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis without warranties of any kind, either
          express or implied, including but not limited to implied warranties
          of merchantability, fitness for a particular purpose, accuracy,
          non-infringement, or quiet enjoyment.
        </Disclaimer>
        <P>
          GENESIS outputs are produced by probabilistic AI systems and may
          contain errors, omissions, hallucinations, or misinterpretations of
          the source paper&apos;s methodology. Generated kernels may compile
          and run while still failing to faithfully implement the original
          paper. You should independently verify any simulation, conclusion,
          equation, or kernel before relying on it for downstream work,
          publication, or product development.
        </P>
        <P>
          Danyar Group makes no representation or warranty that the Service
          will be uninterrupted, error-free, secure, or free of harmful
          components, nor that any defects will be corrected.
        </P>
      </Section>

      <Section>
        <H2>3. Acceptable Use</H2>
        <P>You agree to use the Service only for lawful purposes. You will not:</P>
        <Ul>
          <Li>
            Submit content that is illegal, defamatory, or that infringes the
            intellectual-property or privacy rights of any third party.
          </Li>
          <Li>
            Use the Service to generate content that violates the usage
            policies of the underlying language-model provider, including
            content intended to facilitate physical harm, weapons of mass
            destruction, large-scale cyber-intrusions, or non-consensual
            sexual content.
          </Li>
          <Li>
            Attempt to reverse-engineer the Service, scrape its outputs at
            scale, or use the Service primarily as a data source for training
            competing models.
          </Li>
          <Li>
            Interfere with or disrupt the Service, including via automated
            traffic, denial-of-service techniques, rate-limit evasion, or
            attempts to subvert quota controls.
          </Li>
          <Li>
            Misrepresent yourself or the origin of any output (for example,
            by stripping attribution from a generated kernel and presenting
            it as your own original implementation in a peer-reviewed venue).
          </Li>
        </Ul>
      </Section>

      <Section>
        <H2>4. Your Inputs</H2>
        <P>
          You retain all rights to the URLs and queries you submit. You grant
          Danyar Group a non-exclusive, royalty-free, worldwide license to
          process those inputs solely for the purpose of operating, improving,
          and securing the Service.
        </P>
        <P>
          You are responsible for ensuring that your submission of any URL
          does not violate the rights of the paper&apos;s publisher, authors,
          or any applicable terms of service of the host (for example,
          publisher subscription terms or robots.txt directives). The Service
          fetches only what is publicly addressable at the URL you supply.
        </P>
      </Section>

      <Section>
        <H2>5. Generated Outputs</H2>
        <P>
          You may use the Paper DNA, kernels, and simulations produced by the
          Service for personal, academic, and exploratory research purposes.
          Outputs are generated automatically; they are not authored,
          peer-reviewed, or warranted by Danyar Group, and they should not be
          treated as endorsements of the underlying paper&apos;s claims.
        </P>
        <P>
          When sharing, citing, or building on a GENESIS output, you should:
        </P>
        <Ul>
          <Li>
            Cite the <Strong>original paper</Strong> — not GENESIS — as the
            source of the algorithm being implemented.
          </Li>
          <Li>
            Independently verify correctness before incorporating any kernel
            into a publication, product, or system whose failure would have
            real-world consequences.
          </Li>
          <Li>
            Disclose, where appropriate, that the implementation was generated
            with the assistance of an automated tool.
          </Li>
        </Ul>
      </Section>

      <Section>
        <H2>6. No Professional Advice</H2>
        <P>
          GENESIS does not provide medical, legal, financial, engineering, or
          other professional advice. Outputs of the Service are not a
          substitute for consultation with a qualified professional. Reliance
          on any GENESIS output for decisions in regulated domains is at your
          own risk.
        </P>
      </Section>

      <Section>
        <H2>7. Intellectual Property</H2>
        <P>
          The GENESIS interface, branding, source code, documentation, and
          the pre-computed Canon library are the intellectual property of
          Danyar Group and are protected by applicable copyright, trademark,
          and trade-secret laws. You receive no license to those assets
          beyond what is necessary to use the Service as intended.
        </P>
        <P>
          The underlying scientific papers referenced by the Service remain
          the property of their respective authors and publishers. GENESIS
          makes no claim of ownership over external paper content and does
          not redistribute it beyond what is required to fulfill your request.
        </P>
      </Section>

      <Section>
        <H2>8. Third-Party Services</H2>
        <P>
          The Service depends on third-party APIs (Anthropic, arXiv, OpenAlex,
          NCBI). Their availability, pricing, and terms are outside our
          control. Service degradation, latency, or unavailability caused by
          upstream provider issues does not constitute a breach of these
          Terms.
        </P>
      </Section>

      <Section>
        <H2>9. Limitation of Liability</H2>
        <P>
          To the maximum extent permitted by applicable law, in no event
          shall Danyar Group, its affiliates, officers, employees, or
          contributors be liable for any indirect, incidental, special,
          consequential, exemplary, or punitive damages arising out of or
          related to your use of the Service, including but not limited to
          loss of data, loss of revenue, loss of research time, or scientific
          conclusions drawn from generated outputs.
        </P>
        <P>
          In jurisdictions that do not allow the exclusion of certain
          warranties or liabilities, the foregoing limitations apply only to
          the maximum extent permitted by law in that jurisdiction.
        </P>
      </Section>

      <Section>
        <H2>10. Termination</H2>
        <P>
          We may suspend or terminate your access to the Service at any time,
          with or without notice, for conduct that we believe in good faith
          violates these Terms or is harmful to other users, the Service, or
          third parties. Sections that by their nature should survive
          termination — including disclaimers, limitations of liability, and
          intellectual-property provisions — will survive.
        </P>
      </Section>

      <Section>
        <H2>11. Governing Law</H2>
        <P>
          These Terms are governed by and construed in accordance with the
          laws of the jurisdiction in which Danyar Group is registered,
          without regard to its conflict-of-law provisions. (Operators
          deploying GENESIS should adjust this clause to match their actual
          jurisdiction of registration before going live.)
        </P>
      </Section>

      <Section>
        <H2>12. Changes to These Terms</H2>
        <P>
          We may update these Terms from time to time. The &ldquo;Last
          updated&rdquo; date at the top of this page reflects the most
          recent revision. Continued use of the Service after a material
          change constitutes acceptance of the revised Terms.
        </P>
      </Section>

      <Section>
        <H2>13. Contact</H2>
        <P>
          Questions or notices regarding these Terms should be directed to{" "}
          <Strong>legal@danyargroup.example</Strong>. We aim to respond to
          all good-faith inquiries within a reasonable time.
        </P>
      </Section>
    </LegalPageShell>
  );
}
