import { PDFDocument } from 'pdf-lib-plus-encrypt';

export interface EncryptOptions {
  /** Password required to open the document. */
  password: string;
  /** When true, recipients with the open password still can't copy or edit. */
  restrict?: boolean;
}

/**
 * Password-protect already-built PDF bytes. Returns a new encrypted Uint8Array.
 *
 * Uses pdf-lib-plus-encrypt (a pdf-lib superset) so it runs entirely client-side
 * with no native/WASM dependency. When `restrict` is set, a separate random owner
 * password is used so the copy/edit permissions are actually enforced for anyone
 * who only holds the open password.
 */
export async function encryptPdf(bytes: Uint8Array, opts: EncryptOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const ownerPassword = opts.restrict
    ? `owner-${crypto.randomUUID()}` // unknown to recipients → permissions hold
    : opts.password;

  const permissions = opts.restrict
    ? { printing: 'highResolution' as const, copying: false, modifying: false, annotating: false, fillingForms: true, contentAccessibility: true, documentAssembly: false }
    : { printing: 'highResolution' as const, copying: true, modifying: true, annotating: true, fillingForms: true, contentAccessibility: true, documentAssembly: true };

  await doc.encrypt({ userPassword: opts.password, ownerPassword, permissions });
  return doc.save();
}
