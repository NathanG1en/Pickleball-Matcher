import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Alert,
  BackButton,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Label,
  Modal,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}));

describe("Reusable UI Components", () => {
  describe("Input", () => {
    it("renders default neo-brutalist styling", () => {
      const html = renderToStaticMarkup(<Input placeholder="Enter text" />);
      expect(html).toContain('placeholder="Enter text"');
      expect(html).toContain("border-black");
      expect(html).toContain("shadow-[3px_3px_0px_0px_#000]");
    });

    it("renders compact size and error styling", () => {
      const html = renderToStaticMarkup(
        <Input sizeVariant="sm" hasError placeholder="Error field" />
      );
      expect(html).toContain("border-red-600");
      expect(html).toContain("bg-red-50");
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain("text-sm");
    });
  });

  describe("Textarea", () => {
    it("renders with error and custom classes", () => {
      const html = renderToStaticMarkup(
        <Textarea hasError defaultValue="Sample notes" rows={4} />
      );
      expect(html).toContain("Sample notes");
      expect(html).toContain("border-red-600");
      expect(html).toContain('rows="4"');
    });
  });

  describe("Select", () => {
    it("renders options with neo-brutalist border and shadow", () => {
      const html = renderToStaticMarkup(
        <Select defaultValue="one">
          <option value="one">Option 1</option>
          <option value="two">Option 2</option>
        </Select>
      );
      expect(html).toContain("Option 1");
      expect(html).toContain("border-black");
    });
  });

  describe("Label", () => {
    it("renders required indicator when specified", () => {
      const html = renderToStaticMarkup(
        <Label htmlFor="test-id" required>
          Username
        </Label>
      );
      expect(html).toContain("Username");
      expect(html).toContain("*");
      expect(html).toContain('for="test-id"');
    });
  });

  describe("FormField", () => {
    it("renders label, child input, and hint", () => {
      const html = renderToStaticMarkup(
        <FormField id="email-field" label="Email Address" hint="We will not spam you">
          <Input id="email-field" type="email" />
        </FormField>
      );
      expect(html).toContain("Email Address");
      expect(html).toContain("We will not spam you");
      expect(html).toContain('id="email-field-hint"');
    });

    it("renders error with role alert", () => {
      const html = renderToStaticMarkup(
        <FormField id="email-field" label="Email Address" error="Email is invalid">
          <Input id="email-field" type="email" hasError />
        </FormField>
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain("Email is invalid");
      expect(html).toContain('id="email-field-error"');
    });
  });

  describe("Alert", () => {
    it("renders danger alert with role alert", () => {
      const html = renderToStaticMarkup(
        <Alert variant="danger" title="Error Occurred">
          Something went wrong.
        </Alert>
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain("Error Occurred");
      expect(html).toContain("Something went wrong.");
      expect(html).toContain("bg-[#ff6b6b]");
    });

    it("renders success and warning variants", () => {
      const successHtml = renderToStaticMarkup(
        <Alert variant="success">Saved successfully!</Alert>
      );
      expect(successHtml).toContain("bg-[#ccff00]");

      const warningHtml = renderToStaticMarkup(
        <Alert variant="warning">Session is finishing soon.</Alert>
      );
      expect(warningHtml).toContain("bg-[#fde047]");
    });
  });

  describe("Modal", () => {
    it("returns null when isOpen is false", () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={false} onClose={() => {}}>
          <p>Hidden Content</p>
        </Modal>
      );
      expect(html).toBe("");
    });

    it("renders dialog with title, description, and close button when open", () => {
      const html = renderToStaticMarkup(
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="Session Details"
          description="View active courts and players"
        >
          <p>Modal Body</p>
        </Modal>
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain("Session Details");
      expect(html).toContain("View active courts and players");
      expect(html).toContain("Modal Body");
      expect(html).toContain("×");
    });
  });

  describe("ConfirmDialog", () => {
    it("renders confirmation title, message, and action buttons", () => {
      const html = renderToStaticMarkup(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete Player"
          description="Are you sure you want to delete this player?"
          confirmText="Yes, Delete"
          cancelText="No, Keep"
          confirmVariant="danger"
        />
      );
      expect(html).toContain('role="alertdialog"');
      expect(html).toContain("Delete Player");
      expect(html).toContain("Are you sure you want to delete this player?");
      expect(html).toContain("Yes, Delete");
      expect(html).toContain("No, Keep");
    });
  });

  describe("StatCard", () => {
    it("renders metric value and label", () => {
      const html = renderToStaticMarkup(
        <StatCard label="Total Games" value={42} subtext="+5 this week" />
      );
      expect(html).toContain("42");
      expect(html).toContain("Total Games");
      expect(html).toContain("+5 this week");
    });
  });

  describe("EmptyState", () => {
    it("renders dashed container with title and description", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="No Sessions Found"
          description="Start your first session to track matches."
          action={<button type="button">Create Session</button>}
        />
      );
      expect(html).toContain("border-dashed");
      expect(html).toContain("No Sessions Found");
      expect(html).toContain("Start your first session to track matches.");
      expect(html).toContain("Create Session");
    });
  });

  describe("BackButton", () => {
    it("renders accessible back navigation button", () => {
      const html = renderToStaticMarkup(<BackButton label="← Custom Back" />);
      expect(html).toContain("← Custom Back");
      expect(html).toContain('aria-label="Go back"');
    });
  });
});

