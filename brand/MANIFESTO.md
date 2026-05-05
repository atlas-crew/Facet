# MANIFESTO

Most career-search software is a scam.

Auto-appliers blast your resume to companies that filter it before any human reads it. AI cover letter generators produce something every recruiter recognizes inside two paragraphs. Trackers store notes you'll never reread. Coaches charge three hundred dollars an hour to tell you to "be yourself."

The shape is always the same: take money for something that doesn't work, blame the user when it doesn't work, charge again next time.

The category is full of people taking advantage of the worst moment in someone's career. We're not playing that game.

Facet exists because the work that actually changes the outcome of a job search is the work nobody is helping you do: building a real understanding of what you've done, what it's worth, and how to talk about it for a specific opportunity without lying or flattening yourself in the process. That work is hard, repetitive, and can't be skipped. The tools available either don't help with it or pretend it doesn't exist.

So we built one that does.

## The model is the work

Build a deep model of who you are professionally. That's the kernel.

By "deep" we mean: structured enough that you can query it, complete enough that you don't lose pieces between applications, current enough that it reflects who you are right now and not who you were in 2019. Most candidate-facing tools work from a flat resume document plus whatever the job description has on it. That's a shallow model. It produces shallow output. You can tell because every cover letter generated this way reads like the same letter wearing a different costume.

The model isn't your resume. The resume is one *cut* of the model. Same with the cover letter, the LinkedIn profile, the recruiter card you send to an inside champion. They're all views of the same underlying structure, filtered for context.

Same diamond, different face.

This is the part most tools skip. They jump straight to generating the artifact, because generating an artifact is the part that demos well. Building the model takes time and feels like work. It is work. There's no version of this that gets faster by hiding the model from you and pretending the artifact came from somewhere magic. Anything that pretends otherwise is selling you a faster way to be bad at this.

## Correction over creation

The interaction model matters as much as the data model.

Most AI tools start with a blank page and ask you to fill it. That works fine for tasks where the AI knows more than you about the topic. It works terribly for tasks where the topic is *you*. You already know what you've done. Facet's job isn't to make up a new version of your career and ask you to verify it. Its job is to extract what you already know, structure it, and let you correct what comes out wrong.

Each pass surfaces what was already true.

This is why Facet doesn't generate cover letters from a single prompt. It cuts a face from your existing model, against the analyzed JD, and shows it to you. You correct the parts that don't sound like you. You add context the model didn't know. You retire claims that aren't true anymore. Each correction doesn't just fix that artifact, it sharpens the model the artifact came from. The next cut is closer to right by default.

Refine the model. Don't rewrite it.

The result reads like you because it is you. There are no AI tells because the AI didn't write your story. The AI structured what you said about your story and rendered it into a specific form. The voice was always yours.

## We don't auto-apply

We don't auto-apply because we're not optimizing for volume.

The whole auto-applier category runs on one thesis: more applications equals more interviews. The math only works if the applications are good. Mass-applied resumes aren't. Recruiters know the volume signal of an auto-applier the same way an email service knows the signal of a botnet. Applying to four hundred jobs in a week doesn't get you four hundred shots. It gets you flagged, filtered, and excluded from the small number you might actually have had a chance at.

The tools selling this know the math doesn't work. The pitch is selling effort relief, not outcomes. For the roles you actually want, the application itself is the cheapest part of the process. Auto-applying to them is like printing money to buy lottery tickets.

We're optimizing for the opposite.

Find the jobs where you're the perfect candidate, not just an acceptable one. Present yourself that way, restructured from your raw experience for each opportunity. Then help you prepare for the actual interviews, round by round, with depth that takes the role seriously. The whole system is built around small numbers of good applications, not large numbers of bad ones.

This is the strategy that fits the current market. There was a brief window when mass-application worked: hiring volume was higher than candidate volume, the noise floor was lower, and a competent resume could get a callback on volume alone. That window closed. Mass-applying now is fishing in a lake that's already overfished. Precision is the only move left for someone who actually wants the role.

We don't rearrange bullets. We restructure from your raw experience, every time. The cut that matters is the one that lines up with what they're actually hiring for, not the one that sounds most impressive in general. Showing your true self for the specific role beats showing a generalized version a hundred times over.

The application itself is the user's job. We make sure the materials are right, the prep is deep, and the fit is real when they get there.

## Open notebook, not a teleprompter

Live mode is a real-time interview companion. It is not a cheating tool.

The category of cheating tools (Cluely, Interview Coder, similar) does live transcription of the interviewer and generates AI-authored answers in real time. The candidate reads what the AI produces. That's deceptive in two directions. The interviewer thinks the candidate is answering. The candidate is being assessed on output they didn't author. Both parts are wrong.

Live mode is structurally different. It surfaces a view of the candidate's own prepared knowledge, filtered for the round they're in: the panels they're facing, the topics likely to come up, the time budget for each section. The candidate is reading their own notes, navigated for them, organized for the moment. Same shape as having a study guide on a video call. The candidate is still the author of every answer.

Open notebook, not a teleprompter.

Worth saying out loud: most interviewers know candidates prepare. Some explicitly invite notes. The ones who don't are mostly fine with prepared candidates and not fine with candidates reading content they didn't write. Live respects that line. It helps you find what you prepared. It doesn't generate what you didn't.

The deeper architectural point: Live is just another face of the same diamond. It's a view of your identity model, like the resume or the cover letter, filtered for the conversation moment. Nobody calls a resume a cheatsheet. Nobody objects to a candidate showing up prepared.

## Career-search runs in bursts

Most career-search tools are subscription products. That model is dishonest for this category.

Job searches happen in bursts. A senior engineer searches every two to five years, intensively, for two to four months, then doesn't think about it again until the next burst. Subscription pricing assumes ongoing usage. It charges you during the months you're not searching, on the bet that you'll forget to cancel. The whole pricing model is misaligned with the work.

Facet sells in 90-day passes. That's the duration of an actual search. There's a 12-month window to use it, so you can pause when you need to. When the window closes, the model you built stays yours. Next time you're searching, two or four years from now, you buy another pass. The model is still there. You pick up where you left off.

The career-search runs in bursts. The pricing should too.

The episodic structure also kills a perverse incentive. If we charged monthly, we'd be quietly rooting for your search to take longer. Aligning revenue with active search duration means we want you to find the right role as fast as possible and come back later for the next one. That's the right alignment for a tool that's supposed to help you.

## Your data, your model

The model belongs to you. We mean it structurally, not as marketing.

Every feature in Facet is built so the data is exportable, the code is auditable, and the entire system is self-hostable. You can take the model you built and run it on your own infrastructure. You can read every line of code we wrote. You can verify what the system does with what you tell it. None of these are toggles in a settings panel. They're the structure.

Open-source is the credibility. *Your data, never ours* is the promise.

The reason we can ship export and self-host without losing customers is that the moat isn't your data. The moat is the product. Facet is the place where working with your model is ergonomic, where the analysis runs, where the workflow surfaces exist. Take your data somewhere else and you're starting over on the tooling. Most users won't, because the product is the value. The option is there because that asymmetry is the difference between a tool that respects you and a tool that holds your data hostage to keep you paying.

We're selling a product, not custody.

## What it adds up to

Build the model once. *Recut* it forever.

The model gets sharper every time you use it. After each interview, what was said gets captured as evidence, not anecdote, and folded back into the structure. The faces the model produces get more accurate. The voice gets more recognizably yours. The system you carry from one career chapter to the next is one you actually own.

Search after search, interview after interview, the structure deepens. Every cycle is a deeper version of you.

A deep model of you, professionally. Recut for every opportunity.

That's the whole pitch.

---

*Open-source · Your data, never ours · myfacets.cv*
