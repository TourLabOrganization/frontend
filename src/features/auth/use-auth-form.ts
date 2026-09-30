import { useEffect, useRef, useState } from "react";
import type { FieldErrors } from "./validate";

/**
 * 로그인 · 가입 폼의 칸 값과 오류. 검사는 칸을 떠날 때(onLeave)와 제출할 때(submit) 한다.
 * 입력 중에는 새 오류를 띄우지 않고, 이미 보이는 오류는 고쳐서 맞으면 바로 지운다.
 * 입력칸에 name을 달지 않는다: 스크립트가 붙기 전에 제출되면 브라우저 기본 제출(GET)이 비밀번호를 주소에 싣는다
 */
export function useAuthForm<F extends string>(
  initial: Record<F, string>,
  validate: (values: Record<F, string>) => FieldErrors<F>,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<FieldErrors<F>>>({});
  // 버튼 · 링크를 누르는 중인지. 칸을 떠난 검사를 누르는 도중에 그리면 오류 문구가 끼어
  // 아래 제출 버튼 · 링크가 밀리고, 손을 뗄 때 click이 그 밖에 떨어져 누른 것이 빗나간다
  const pressing = useRef(false);

  useEffect(() => {
    const down = () => {
      pressing.current = true;
    };
    const up = () => {
      pressing.current = false;
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);

  /** 누르는 중이면 손을 뗀 뒤, 아니면 지금 이벤트(터치는 뒤따르는 click까지)가 끝난 뒤에 한다 */
  function afterPress(run: () => void) {
    if (!pressing.current) {
      setTimeout(run, 0);
      return;
    }
    const release = () => {
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      setTimeout(run, 0);
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
  }

  /** AuthField에 펼쳐 넣는 값 */
  function field(name: F) {
    return {
      "data-field": name,
      value: values[name],
      error: errors[name] ?? null,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = { ...values, [name]: e.target.value } as Record<F, string>;
        setValues(next);
        if (errors[name] && !validate(next)[name]) {
          setErrors((prev) => ({ ...prev, [name]: null }));
        }
      },
      onLeave: () =>
        afterPress(() =>
          setErrors((prev) => ({ ...prev, [name]: validate(values)[name] })),
        ),
    };
  }

  /** 모든 칸을 검사한다. 막히면 첫 오류 칸에 초점을 두고 null, 통과하면 값 */
  function submit(form: HTMLFormElement): Record<F, string> | null {
    const found = validate(values);
    setErrors(found);
    const first = (Object.keys(values) as F[]).find((name) => found[name]);
    if (first === undefined) return values;
    form.querySelector<HTMLInputElement>(`[data-field="${first}"]`)?.focus();
    return null;
  }

  return { field, submit };
}
