import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useEditorStore } from '../store/editorStore';

interface FieldRect { x: number; y: number; w: number; h: number; }

interface FormField {
  key: string;         // unique per-field (fieldName + index)
  fieldName: string;
  fieldType: string;   // 'Tx' | 'Btn' | 'Ch'
  initialValue: string | boolean;
  rect: FieldRect;
  multiLine?: boolean;
  checkBox?: boolean;
  radioButton?: boolean;
  buttonValue?: string;
  options?: string[];
  combo?: boolean;
  readOnly?: boolean;
}

interface Props {
  pdfPage: pdfjsLib.PDFPageProxy;
  scale: number;
}

export default function FormFieldLayer({ pdfPage, scale }: Props) {
  const [fields, setFields] = useState<FormField[]>([]);
  const { formFieldValues, setFormFieldValue } = useEditorStore();

  useEffect(() => {
    let cancelled = false;
    pdfPage.getAnnotations({ intent: 'display' }).then((annots: any[]) => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      const widgets = annots.filter((a) => a.subtype === 'Widget');
      const parsed: FormField[] = [];

      widgets.forEach((ann, idx) => {
        const vr = viewport.convertToViewportRectangle(ann.rect);
        const x = Math.min(vr[0], vr[2]);
        const y = Math.min(vr[1], vr[3]);
        const w = Math.abs(vr[2] - vr[0]);
        const h = Math.abs(vr[3] - vr[1]);

        let initialValue: string | boolean = '';
        if (ann.fieldType === 'Btn' && (ann.checkBox || ann.radioButton)) {
          initialValue = ann.fieldValue === ann.buttonValue || ann.fieldValue === 'Yes' || ann.fieldValue === 'On';
        } else {
          initialValue = Array.isArray(ann.fieldValue)
            ? ann.fieldValue[0] ?? ''
            : (ann.fieldValue ?? ann.defaultFieldValue ?? '');
        }

        const opts: string[] = [];
        if (ann.options) {
          for (const o of ann.options) {
            opts.push(typeof o === 'string' ? o : (o.displayValue || o.exportValue || ''));
          }
        }

        parsed.push({
          key: `${ann.fieldName ?? 'field'}-${idx}`,
          fieldName: ann.fieldName ?? `__field_${idx}`,
          fieldType: ann.fieldType ?? 'Tx',
          initialValue,
          rect: { x, y, w, h },
          multiLine: !!ann.multiLine,
          checkBox: !!ann.checkBox,
          radioButton: !!ann.radioButton,
          buttonValue: ann.buttonValue,
          options: opts.length ? opts : undefined,
          combo: !!ann.combo,
          readOnly: !!(ann.readOnly),
        });
      });

      setFields(parsed);
    }).catch(() => setFields([]));

    return () => { cancelled = true; };
  }, [pdfPage, scale]);

  if (!fields.length) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}>
      {fields.map((field) => {
        const { x, y, w, h } = field.rect;
        const storeKey = field.fieldName;
        const value = storeKey in formFieldValues ? formFieldValues[storeKey] : field.initialValue;
        const fontSize = Math.max(8, Math.round(h * 0.55));

        const baseStyle: React.CSSProperties = {
          position: 'absolute', left: x, top: y, width: w, height: h,
          boxSizing: 'border-box', pointerEvents: field.readOnly ? 'none' : 'all',
          background: 'rgba(255, 255, 200, 0.85)',
          border: '1.5px solid rgba(59,130,246,0.7)',
          borderRadius: 2,
          outline: 'none',
          fontSize,
          fontFamily: 'Arial, sans-serif',
          color: '#111',
          padding: '1px 3px',
        };

        if (field.fieldType === 'Btn' && field.checkBox) {
          const isChecked = !!value;
          const size = Math.min(w, h) * 0.65;
          return (
            <div
              key={field.key}
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => { if (!field.readOnly) setFormFieldValue(storeKey, !isChecked); }}
              style={{
                position: 'absolute', left: x, top: y, width: w, height: h,
                cursor: field.readOnly ? 'default' : 'pointer',
                pointerEvents: field.readOnly ? 'none' : 'all',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              {isChecked && (
                <svg width={size} height={size} viewBox="0 0 12 12" style={{ pointerEvents: 'none' }}>
                  <polyline
                    points="1.5,6 4.5,9.5 10.5,2"
                    stroke="#1d4ed8"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          );
        }

        if (field.fieldType === 'Ch') {
          return (
            <select
              key={field.key}
              value={value as string}
              disabled={field.readOnly}
              onChange={(e) => setFormFieldValue(storeKey, e.target.value)}
              style={{ ...baseStyle, cursor: 'pointer' }}
            >
              <option value="">—</option>
              {(field.options ?? []).map((o, i) => (
                <option key={i} value={o}>{o}</option>
              ))}
            </select>
          );
        }

        // Default: text field (Tx) — multiline or single-line
        if (field.multiLine) {
          return (
            <textarea
              key={field.key}
              value={value as string}
              readOnly={field.readOnly}
              onChange={(e) => setFormFieldValue(storeKey, e.target.value)}
              style={{ ...baseStyle, resize: 'none', overflow: 'hidden', lineHeight: 1.3 }}
            />
          );
        }
        return (
          <input
            key={field.key}
            type="text"
            value={value as string}
            readOnly={field.readOnly}
            onChange={(e) => setFormFieldValue(storeKey, e.target.value)}
            style={{ ...baseStyle, lineHeight: String(h) + 'px' }}
          />
        );
      })}
    </div>
  );
}
