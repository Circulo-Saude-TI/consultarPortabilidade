import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { jsPDF } from 'jspdf';

import { PortabilidadeService } from './portabilidade.service';

@Component({
  selector: 'app-portabilidade',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './portabilidade.component.html',
  styleUrl: './portabilidade.component.scss'
})
export class PortabilidadeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly portabilidadeService = inject(PortabilidadeService);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly portabilidadeForm = this.fb.group({
    cpfCnpj: [
      '',
      [Validators.required]
    ]
  });

  protected submitted = false;
  protected loading = false;
  protected errorMsg = '';
  protected successMsg = '';
  protected showToast = false;
  protected toastMessage = '';
  protected toastType: 'success' | 'error' = 'success';

  constructor() {
    this.cpfCnpj?.valueChanges.subscribe((value) => {
      if (value) {
        const formatted = this.formatCpfCnpj(value);
        if (formatted !== value) {
          this.cpfCnpj?.setValue(formatted, { emitEvent: false });
        }
      }
    });
  }

  protected onSubmit(): void {
    this.submitted = true;
    this.errorMsg = '';
    this.successMsg = '';
    this.showToast = false;

    if (this.portabilidadeForm.invalid) return;

    const cpfCnpj = (this.cpfCnpj?.value || '').toString().replace(/\D/g, '').trim();

    this.loading = true;
    void this.processDeclaracao(cpfCnpj)
      .finally(() => {
        this.loading = false;
      });
  }

  protected blockNonNumeric(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];

    if (event.ctrlKey || event.metaKey) return; // allow copy/paste and shortcuts
    if (allowedKeys.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  protected get cpfCnpj() {
    return this.portabilidadeForm.get('cpfCnpj');
  }

  private formatCpfCnpj(value: string): string {
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length <= 11) {
      // CPF: 000.000.000-00
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{3})/, '$1.$2')
        .replace(/(\d{3})(\d{2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return cleaned
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{3})/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{2})$/, '$1-$2');
    }
  }

  private async processDeclaracao(chaveUnica: string): Promise<void> {
    try {
      const declaracaoId = await this.portabilidadeService.listarDeclaracao(chaveUnica);
      if (!declaracaoId) {
        this.toastMessage = 'Nenhuma declaração encontrada para este CPF/CNPJ.';
        this.toastType = 'error';
        this.showToast = true;
        setTimeout(() => {
          this.showToast = false;
        }, 4000);
        return;
      }

      const base64 = await this.portabilidadeService.obterDeclaracaoPdf(chaveUnica, declaracaoId);
      if (!base64) {
        this.toastMessage = 'Falha ao obter o documento.';
        this.toastType = 'error';
        this.showToast = true;
        setTimeout(() => {
          this.showToast = false;
        }, 4000);
        return;
      }

      await this.baixarBase64(base64, 'carta-portabilidade.rtf', 'application/rtf', false);
      this.toastMessage = 'Carta gerada com sucesso!';
      this.toastType = 'success';
      this.showToast = true;
      this.cdr.detectChanges(); // Força detecção de mudanças

      setTimeout(() => {
        this.showToast = false;
        this.portabilidadeForm.reset();
        this.submitted = false;
        this.cdr.detectChanges();
      }, 3000);
    } catch (error) {
      console.error(error);
      // Verifica se é erro de beneficiário não encontrado (404)
      if (error instanceof Error && error.message === 'Beneficiário não encontrado') {
        this.toastMessage = 'Beneficiário não encontrado. Verifique o CPF/CNPJ informado.';
      } else {
        this.toastMessage = 'Erro ao processar a declaração.';
      }
      this.toastType = 'error';
      this.showToast = true;
      this.cdr.detectChanges(); // Força detecção de mudanças
      setTimeout(() => {
        this.showToast = false;
        this.cdr.detectChanges();
      }, 4000);
    }
  }

  private async baixarBase64(base64: string, filename: string, mime: string, isRtf: boolean = false): Promise<void> {
    try {
      if (isRtf && mime === 'application/pdf') {
        // Converte RTF para PDF
        await this.converterRtfParaPdf(base64, filename);
      } else {
        // Download direto do blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error(error);
      this.toastMessage = 'Erro ao baixar o arquivo.';
      this.toastType = 'error';
      this.showToast = true;
      setTimeout(() => {
        this.showToast = false;
      }, 4000);
    }
  }

  private async converterRtfParaPdf(rtfBase64: string, filename: string): Promise<void> {
    try {
      // Decodifica RTF de base64
      const rtfText = atob(rtfBase64);

      // Parser RTF melhorado
      let texto = this.extrairTextoRtf(rtfText);

      // Cria PDF com jsPDF
      const doc = new jsPDF();

      // Configurações
      doc.setFontSize(11);
      doc.setFont('helvetica');

      // Adiciona o texto com quebra automática
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const lineHeight = 6;
      const maxWidth = pageWidth - 2 * margin;

      const lines = doc.splitTextToSize(texto, maxWidth);

      let yPosition = margin;
      for (const line of lines) {
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      }

      // Salva o PDF
      doc.save(filename);
    } catch (error) {
      console.error('Erro ao converter RTF para PDF:', error);
      this.toastMessage = 'Erro ao converter arquivo para PDF.';
      this.toastType = 'error';
      this.showToast = true;
      setTimeout(() => {
        this.showToast = false;
      }, 4000);
    }
  }

  private extrairTextoRtf(rtf: string): string {
    let texto = '';
    let nivelGrupo = 0;
    let dentroFonttbl = false;
    let dentroColortbl = false;
    let dentroStylesheet = false;
    let dentroInfo = false;
    let i = 0;

    while (i < rtf.length) {
      const char = rtf[i];

      if (char === '{') {
        nivelGrupo++;
        // Verifica se está entrando em grupo especial
        const proximoTexto = rtf.substring(i, i + 20);
        if (proximoTexto.includes('\\fonttbl')) dentroFonttbl = true;
        if (proximoTexto.includes('\\colortbl')) dentroColortbl = true;
        if (proximoTexto.includes('\\stylesheet')) dentroStylesheet = true;
        if (proximoTexto.includes('\\info')) dentroInfo = true;
        i++;
      } else if (char === '}') {
        nivelGrupo--;
        // Sai de grupos especiais
        if (dentroFonttbl && nivelGrupo <= 1) dentroFonttbl = false;
        if (dentroColortbl && nivelGrupo <= 1) dentroColortbl = false;
        if (dentroStylesheet && nivelGrupo <= 1) dentroStylesheet = false;
        if (dentroInfo && nivelGrupo <= 1) dentroInfo = false;
        i++;
      } else if (char === '\\') {
        i++;
        let comando = '';
        let param = '';

        // Lê o comando
        while (i < rtf.length && /[a-z]/i.test(rtf[i])) {
          comando += rtf[i];
          i++;
        }

        // Lê parâmetro numérico
        const inicioParam = i;
        if (i < rtf.length && (rtf[i] === '-' || /\d/.test(rtf[i]))) {
          if (rtf[i] === '-') {
            param += rtf[i];
            i++;
          }
          while (i < rtf.length && /\d/.test(rtf[i])) {
            param += rtf[i];
            i++;
          }
        }

        // Pula espaço delimitador
        if (i < rtf.length && rtf[i] === ' ') {
          i++;
        }

        // Ignora conteúdo de grupos especiais
        if (dentroFonttbl || dentroColortbl || dentroStylesheet || dentroInfo) {
          continue;
        }

        // Processa comandos de formatação
        if (comando === 'par' || comando === 'line') {
          texto += '\n';
        } else if (comando === 'tab') {
          texto += '    ';
        } else if (comando === "'") {
          // Caractere codificado em hex
          const hex = rtf.substring(i, i + 2);
          i += 2;
          try {
            const code = parseInt(hex, 16);
            texto += String.fromCharCode(code);
          } catch (e) {
            // Ignora erros
          }
        }
      } else if (!dentroFonttbl && !dentroColortbl && !dentroStylesheet && !dentroInfo) {
        // Adiciona caractere normal se não estiver em grupo especial
        if (char !== '\n' && char !== '\r' && nivelGrupo > 0) {
          texto += char;
        }
        i++;
      } else {
        i++;
      }
    }

    // Limpa e formata o texto final
    return texto
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n /g, '\n')
      .trim();
  }
}
