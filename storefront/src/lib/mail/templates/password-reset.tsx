/**
 * Pim Etiket — Admin tetiklemeli şifre sıfırlama maili.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles } from "./base";

export interface PasswordResetProps {
  recipientEmail: string;
  resetLink: string;
}

export function PasswordResetEmail({
  recipientEmail,
  resetLink,
}: PasswordResetProps) {
  return (
    <BaseLayout preview="Şifreni sıfırla">
      <Eyebrow>Hesap güvenliği</Eyebrow>
      <Text style={mailStyles.h1}>Şifre sıfırlama</Text>
      <Text style={mailStyles.p}>
        {recipientEmail} hesabı için şifre sıfırlama talebi aldık. Aşağıdaki
        butona tıklayıp yeni şifreni belirleyebilirsin. Link tek kullanımlık;
        sen talep etmediysen bu maili yok say.
      </Text>
      <Button href={resetLink} label="Şifremi sıfırla" />
      <Text style={mailStyles.pSecondary}>
        Buton çalışmıyorsa destek üzerinden bize yaz.
      </Text>
    </BaseLayout>
  );
}
