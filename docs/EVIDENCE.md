# Behavioral rationale

ReRoute is built around one claim from behavior-change research: **people keep healthy habits not by never slipping, but by having a plan for when they do, and by coming back quickly after a break.** Each feature maps to a technique with published support. ReRoute has **not** been tested, so none of this shows ReRoute itself works; it explains why the design is a reasonable bet and what a pilot should test.

| Design choice | Technique | Why it's expected to help | Where in the app |
| --- | --- | --- | --- |
| "If time gets away from me, I'll take the stairs" plans set at onboarding | **Implementation intentions** and **coping planning** | If-then plans link a cue to a response in advance. A meta-analysis of 94 studies found a medium-to-large effect on goal attainment (Gollwitzer & Sheeran, 2006). Coping plans that anticipate barriers helped people maintain exercise (Sniehotta, Scholz & Schwarzer, 2005). | Onboarding step 2, *My if-then plans*, "Make this my plan" after a detour |
| "Plans changed" offers a smaller, still-feasible alternative | Problem solving / graded tasks (BCT taxonomy 1.2, 8.7) | Lowering the effort of the next step keeps the intention alive when circumstances change, instead of forcing all-or-nothing. | Barrier sheet → ranked detours with reasons |
| No streaks; rest days are a deliberate choice; "comebacks" are counted and celebrated | Avoiding the **abstinence-violation effect** | Treating one lapse as total failure makes full relapse more likely (Marlatt & Gordon, 1985). In a habit-formation study, missing a single opportunity did not materially affect habit development (Lally et al., 2010). | Welcome-back sheet, comeback count, rest days that never count as lapses |
| Very short options (1–10 minutes) | "Every move counts" | WHO guidelines state that any amount of physical activity is better than none, and that small amounts count towards the weekly total (WHO, 2020). | Activity library |
| A world that grows with each journey | Non-specific reward, self-monitoring (BCT 10.3, 2.3) | Immediate, visible feedback for the behavior itself, not for screen time. | Island reveals, *My journey* |
| Explanation for each suggestion | Autonomy support | People choose; the app explains why it suggests something and never decides for them. | "Why this?" on every detour |

The capability–opportunity–motivation framing (COM-B; Michie, van Stralen & West, 2011) organizes the barriers: *time* and *space* are opportunity barriers, *energy* is capability, *motivation* is motivation, and *weather* is a physical opportunity barrier.

## What would change our mind

The pilot ([PILOT.md](PILOT.md)) is designed to show whether the detour and comeback features improve **return after a lapse** compared with a fixed-plan version. If they don't, the island is just a nice skin on a timer, and that is worth knowing.

## References

- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. *Advances in Experimental Social Psychology, 38*, 69–119.
- Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. *European Journal of Social Psychology, 40*(6), 998–1009.
- Marlatt, G. A., & Gordon, J. R. (Eds.). (1985). *Relapse prevention: Maintenance strategies in the treatment of addictive behaviors.* Guilford Press.
- Michie, S., van Stralen, M. M., & West, R. (2011). The behaviour change wheel: A new method for characterising and designing behaviour change interventions. *Implementation Science, 6*, 42.
- Michie, S., et al. (2013). The behavior change technique taxonomy (v1) of 93 hierarchically clustered techniques. *Annals of Behavioral Medicine, 46*(1), 81–95.
- Sniehotta, F. F., Scholz, U., & Schwarzer, R. (2005). Bridging the intention–behaviour gap: Planning, self-efficacy, and action control in the adoption and maintenance of physical exercise. *Psychology & Health, 20*(2), 143–160.
- World Health Organization. (2020). *WHO guidelines on physical activity and sedentary behaviour.*
