/** Provider-independent business profile associated with a Qleanfeel User. */
export interface Profile {
  readonly userId: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly avatar: string | null;
  readonly locale: string | null;
  readonly country: string | null;
}
