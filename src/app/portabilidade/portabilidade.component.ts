import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
      .catch((err) => {
        console.error(err);
        this.toastMessage = 'Não foi possível gerar a carta. Tente novamente.';
        this.toastType = 'error';
        this.showToast = true;
        setTimeout(() => {
          this.showToast = false;
        }, 4000);
      })
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

      this.baixarBase64(base64, 'carta-portabilidade.rtf', 'application/rtf');
      this.toastMessage = 'Carta gerada com sucesso!';
      this.toastType = 'success';
      this.showToast = true;

      setTimeout(() => {
        this.showToast = false;
        this.portabilidadeForm.reset();
        this.submitted = false;
      }, 3000);
    } catch (error) {
      console.error(error);
      this.toastMessage = 'Erro ao processar a declaração.';
      this.toastType = 'error';
      this.showToast = true;
      setTimeout(() => {
        this.showToast = false;
      }, 4000);
    }
  }

  private baixarBase64(base64: string, filename: string, mime: string): void {
    try {
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
}
