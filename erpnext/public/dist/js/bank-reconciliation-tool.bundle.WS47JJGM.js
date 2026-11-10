(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };

  // ../erpnext/erpnext/public/js/bank_reconciliation_tool/data_table_manager.js
  frappe.provide("erpnext.accounts.bank_reconciliation");
  erpnext.accounts.bank_reconciliation.DataTableManager = class DataTableManager {
    constructor(opts) {
      Object.assign(this, opts);
      this.dialog_manager = new erpnext.accounts.bank_reconciliation.DialogManager(
        this.company,
        this.bank_account,
        this.bank_statement_from_date,
        this.bank_statement_to_date,
        this.filter_by_reference_date,
        this.from_reference_date,
        this.to_reference_date
      );
      this.make_dt();
    }
    make_dt() {
      const me = this;
      frappe.call({
        method: "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.get_bank_transactions",
        args: {
          bank_account: this.bank_account,
          from_date: this.bank_statement_from_date,
          to_date: this.bank_statement_to_date
        },
        callback: function(response) {
          me.format_data(response.message);
          me.get_dt_columns();
          me.get_datatable();
          me.set_listeners();
        }
      });
    }
    get_dt_columns() {
      this.columns = [
        {
          name: __("Date"),
          editable: false,
          width: 100,
          format: frappe.form.formatters.Date
        },
        {
          name: __("Party Type"),
          editable: false,
          width: 95
        },
        {
          name: __("Party"),
          editable: false,
          width: 100
        },
        {
          name: __("Description"),
          editable: false,
          width: 350
        },
        {
          name: __("Deposit"),
          editable: false,
          width: 100,
          format: (value) => "<span style='color:green;'>" + format_currency(value, this.currency) + "</span>"
        },
        {
          name: __("Withdrawal"),
          editable: false,
          width: 100,
          format: (value) => "<span style='color:red;'>" + format_currency(value, this.currency) + "</span>"
        },
        {
          name: __("Unallocated Amount"),
          editable: false,
          width: 100,
          format: (value) => "<span style='color:var(--blue-500);'>" + format_currency(value, this.currency) + "</span>"
        },
        {
          name: __("Reference Number"),
          editable: false,
          width: 140
        },
        {
          name: __("Actions"),
          editable: false,
          sortable: false,
          focusable: false,
          dropdown: false,
          width: 100
        }
      ];
    }
    format_data(transactions) {
      this.transactions = [];
      if (transactions[0]) {
        this.currency = transactions[0]["currency"];
      }
      this.transaction_dt_map = {};
      let length;
      transactions.forEach((row) => {
        length = this.transactions.push(this.format_row(row));
        this.transaction_dt_map[row["name"]] = length - 1;
      });
    }
    format_row(row) {
      return [
        row["date"],
        row["party_type"],
        frappe.form.formatters.Link(row["party"], { options: row["party_type"] }),
        row["description"],
        row["deposit"],
        row["withdrawal"],
        row["unallocated_amount"],
        row["reference_number"],
        `<button class="btn btn-primary btn-xs center" data-name="${row["name"]}">${__(
          "Actions"
        )}</button>`
      ];
    }
    get_datatable() {
      const datatable_options = {
        columns: this.columns,
        data: this.transactions,
        dynamicRowHeight: true,
        checkboxColumn: false,
        inlineFilters: true
      };
      this.datatable = new frappe.DataTable(this.$reconciliation_tool_dt.get(0), datatable_options);
      $(`.${this.datatable.style.scopeClass} .dt-scrollable`).css("max-height", "calc(100vh - 400px)");
      if (this.transactions.length > 0) {
        this.$reconciliation_tool_dt.show();
        this.$no_bank_transactions.hide();
      } else {
        this.$reconciliation_tool_dt.hide();
        this.$no_bank_transactions.show();
      }
    }
    set_listeners() {
      var me = this;
      $(`.${this.datatable.style.scopeClass} .dt-scrollable`).on("click", `.btn`, function() {
        me.dialog_manager.show_dialog(
          $(this).attr("data-name"),
          (bank_transaction) => me.update_dt_cards(bank_transaction)
        );
        return true;
      });
    }
    update_dt_cards(bank_transaction) {
      const transaction_index = this.transaction_dt_map[bank_transaction.name];
      if (bank_transaction.unallocated_amount > 0) {
        this.transactions[transaction_index] = this.format_row(bank_transaction);
      } else {
        this.transactions.splice(transaction_index, 1);
        for (const [k, v] of Object.entries(this.transaction_dt_map)) {
          if (v > transaction_index)
            this.transaction_dt_map[k] = v - 1;
        }
      }
      this.datatable.refresh(this.transactions, this.columns);
      if (this.transactions.length == 0) {
        this.$reconciliation_tool_dt.hide();
        this.$no_bank_transactions.show();
      }
      this.get_cleared_balance().then(() => {
        this.cards_manager.$cards[1].set_value(format_currency(this.cleared_balance), this.currency);
        this.cards_manager.$cards[2].set_value(
          format_currency(this.bank_statement_closing_balance - this.cleared_balance),
          this.currency
        );
        this.cards_manager.$cards[2].set_value_color(
          this.bank_statement_closing_balance - this.cleared_balance == 0 ? "text-success" : "text-danger"
        );
      });
    }
    get_cleared_balance() {
      if (this.bank_account && this.bank_statement_to_date) {
        return frappe.call({
          method: "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.get_account_balance",
          args: {
            bank_account: this.bank_account,
            till_date: this.bank_statement_to_date,
            company: this.company
          },
          callback: (response) => this.cleared_balance = response.message
        });
      }
    }
  };

  // ../erpnext/erpnext/public/js/bank_reconciliation_tool/number_card.js
  frappe.provide("erpnext.accounts.bank_reconciliation");
  erpnext.accounts.bank_reconciliation.NumberCardManager = class NumberCardManager {
    constructor(opts) {
      Object.assign(this, opts);
      this.make_cards();
    }
    make_cards() {
      this.$reconciliation_tool_cards.empty();
      this.$cards = [];
      this.$summary = $(`<div class="report-summary"></div>`).hide().appendTo(this.$reconciliation_tool_cards);
      var chart_data = [
        {
          value: this.bank_statement_closing_balance,
          label: __("Closing Balance as per Bank Statement"),
          datatype: "Currency",
          currency: this.currency
        },
        {
          value: this.cleared_balance,
          label: __("Closing Balance as per ERP"),
          datatype: "Currency",
          currency: this.currency
        },
        {
          value: flt(this.bank_statement_closing_balance) - flt(this.cleared_balance),
          label: __("Difference"),
          datatype: "Currency",
          currency: this.currency
        }
      ];
      chart_data.forEach((summary) => {
        let number_card = new erpnext.accounts.NumberCard(summary);
        this.$cards.push(number_card);
        number_card.$card.appendTo(this.$summary);
      });
      this.$cards[2].set_value_color(
        this.bank_statement_closing_balance - this.cleared_balance == 0 ? "text-success" : "text-danger"
      );
      this.$summary.css({ "border-bottom": "0px", "margin-left": "0px", "margin-right": "0px" });
      this.$summary.show();
    }
  };
  erpnext.accounts.NumberCard = class NumberCard {
    constructor(options) {
      this.$card = frappe.utils.build_summary_item(options);
    }
    set_value(value) {
      this.$card.find("div").text(value);
    }
    set_value_color(color) {
      this.$card.find("div").removeClass("text-danger text-success").addClass(`${color}`);
    }
    set_indicator(color) {
      this.$card.find("span").removeClass("indicator red green").addClass(`indicator ${color}`);
    }
  };

  // ../erpnext/erpnext/public/js/bank_reconciliation_tool/dialog_manager.js
  frappe.provide("erpnext.accounts.bank_reconciliation");
  frappe.provide("erpnext.accounts.bank_reconciliation.voucher_types");
  erpnext.accounts.bank_reconciliation.voucher_types = __spreadValues({
    "Payment Entry": {
      create(dialog_manager, values, allow_edit) {
        return frappe.xcall(
          "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.create_payment_entry_bts",
          {
            bank_transaction_name: dialog_manager.bank_transaction.name,
            reference_number: values.reference_number,
            reference_date: values.reference_date,
            party_type: values.party_type,
            party: values.party,
            posting_date: values.posting_date,
            mode_of_payment: values.mode_of_payment,
            project: values.project,
            cost_center: values.cost_center,
            allow_edit,
            company_bank_account: (values == null ? void 0 : values.bank_account) || (dialog_manager == null ? void 0 : dialog_manager.bank_account)
          }
        );
      }
    },
    "Journal Entry": {
      create(dialog_manager, values, allow_edit) {
        return frappe.xcall(
          "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.create_journal_entry_bts",
          {
            bank_transaction_name: dialog_manager.bank_transaction.name,
            reference_number: values.reference_number,
            reference_date: values.reference_date,
            party_type: values.party_type,
            party: values.party,
            posting_date: values.posting_date,
            mode_of_payment: values.mode_of_payment,
            entry_type: values.journal_entry_type,
            second_account: values.second_account,
            allow_edit
          }
        );
      }
    }
  }, erpnext.accounts.bank_reconciliation.voucher_types);
  erpnext.accounts.bank_reconciliation.DialogManager = class DialogManager {
    constructor(company, bank_account, bank_statement_from_date, bank_statement_to_date, filter_by_reference_date, from_reference_date, to_reference_date) {
      this.bank_account = bank_account;
      this.company = company;
      this.make_dialog();
      this.bank_statement_from_date = bank_statement_from_date;
      this.bank_statement_to_date = bank_statement_to_date;
      this.filter_by_reference_date = filter_by_reference_date;
      this.from_reference_date = from_reference_date;
      this.to_reference_date = to_reference_date;
    }
    show_dialog(bank_transaction_name, update_dt_cards) {
      this.bank_transaction_name = bank_transaction_name;
      this.update_dt_cards = update_dt_cards;
      frappe.call({
        method: "frappe.client.get_value",
        args: {
          doctype: "Bank Transaction",
          filters: { name: this.bank_transaction_name },
          fieldname: [
            "date",
            "deposit",
            "withdrawal",
            "currency",
            "description",
            "name",
            "bank_account",
            "company",
            "reference_number",
            "party_type",
            "party",
            "unallocated_amount",
            "allocated_amount",
            "transaction_type"
          ]
        },
        callback: (r) => {
          if (r.message) {
            this.bank_transaction = r.message;
            r.message.payment_entry = 1;
            r.message.journal_entry = 1;
            this.set_document_type_options();
            this.dialog.set_values(r.message);
            this.copy_data_to_voucher();
            this.dialog.show();
          }
        }
      });
    }
    get_voucher_types() {
      return erpnext.accounts.bank_reconciliation.voucher_types;
    }
    get_document_types() {
      return Object.entries(this.get_voucher_types()).filter(
        ([, voucher_type]) => !this.bank_transaction || !voucher_type.is_applicable || voucher_type.is_applicable(this.bank_transaction)
      ).map(([document_type]) => document_type);
    }
    set_document_type_options() {
      const document_types = this.get_document_types();
      this.dialog.set_df_property("document_type", "options", document_types.join("\n"));
      if (!document_types.includes(this.dialog.get_value("document_type"))) {
        this.dialog.set_value("document_type", document_types[0]);
      }
    }
    copy_data_to_voucher() {
      let copied = {
        reference_number: this.bank_transaction.reference_number || this.bank_transaction.description,
        posting_date: this.bank_transaction.date,
        reference_date: this.bank_transaction.date,
        mode_of_payment: this.bank_transaction.transaction_type
      };
      this.dialog.set_values(copied);
    }
    get_linked_vouchers(document_types) {
      frappe.call({
        method: "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.get_linked_payments",
        args: {
          bank_transaction_name: this.bank_transaction_name,
          document_types,
          from_date: this.bank_statement_from_date,
          to_date: this.bank_statement_to_date,
          filter_by_reference_date: this.filter_by_reference_date,
          from_reference_date: this.from_reference_date,
          to_reference_date: this.to_reference_date
        },
        callback: (result) => {
          const data = result.message;
          if (data && data.length > 0) {
            const proposals_wrapper = this.dialog.fields_dict.payment_proposals.$wrapper;
            proposals_wrapper.show();
            this.dialog.fields_dict.no_matching_vouchers.$wrapper.hide();
            this.data = data.map((row) => this.format_row(row));
            this.get_dt_columns();
            this.get_datatable(proposals_wrapper);
          } else {
            const proposals_wrapper = this.dialog.fields_dict.payment_proposals.$wrapper;
            proposals_wrapper.hide();
            this.dialog.fields_dict.no_matching_vouchers.$wrapper.show();
          }
          this.dialog.show();
        }
      });
    }
    get_dt_columns() {
      this.columns = [
        {
          name: __("Document Type"),
          editable: false,
          width: 125
        },
        {
          name: __("Document Name"),
          editable: false,
          width: 1,
          format: (value, row) => {
            return frappe.form.formatters.Link(value, { options: row[2].content });
          }
        },
        {
          name: __("Reference Date"),
          editable: false,
          width: 120,
          format: frappe.form.formatters.Date
        },
        {
          name: __("Remaining"),
          editable: false,
          width: 100
        },
        {
          name: __("Reference Number"),
          editable: false,
          width: 200
        },
        {
          name: __("Party"),
          editable: false,
          width: 100
        }
      ];
    }
    format_row(row) {
      return [
        row["doctype"],
        row["name"],
        row["reference_date"] || row["posting_date"],
        format_currency(row["paid_amount"], row["currency"]),
        row["reference_no"],
        row["party"]
      ];
    }
    get_datatable(proposals_wrapper) {
      if (!this.dialog.display) {
        this.dialog.on_page_show = () => {
          this.dialog.on_page_show = null;
          this.get_datatable(proposals_wrapper);
        };
        return;
      }
      if (!this.datatable) {
        const datatable_options = {
          columns: this.columns,
          data: this.data,
          dynamicRowHeight: true,
          checkboxColumn: true,
          inlineFilters: true
        };
        this.datatable = new frappe.DataTable(proposals_wrapper.get(0), datatable_options);
      } else {
        this.datatable.refresh(this.data, this.columns);
        this.datatable.rowmanager.checkMap = [];
      }
    }
    make_dialog() {
      const me = this;
      me.selected_payment = null;
      const fields = [
        {
          label: __("Action"),
          fieldname: "action",
          fieldtype: "Select",
          options: `Match Against Voucher
Create Voucher
Update Bank Transaction`,
          default: "Match Against Voucher"
        },
        {
          fieldname: "column_break_4",
          fieldtype: "Column Break"
        },
        {
          label: __("Document Type"),
          fieldname: "document_type",
          fieldtype: "Select",
          options: this.get_document_types().join("\n"),
          default: "Payment Entry",
          depends_on: "eval:doc.action=='Create Voucher'"
        },
        {
          fieldtype: "Section Break",
          fieldname: "section_break_1",
          label: __("Filters"),
          depends_on: "eval:doc.action=='Match Against Voucher'"
        }
      ];
      frappe.call({
        method: "erpnext.accounts.doctype.bank_transaction.bank_transaction.get_doctypes_for_bank_reconciliation",
        callback: (r) => {
          $.each(r.message, (_i, entry) => {
            if (_i % 3 == 0) {
              fields.push({
                fieldtype: "Column Break"
              });
            }
            fields.push({
              fieldtype: "Check",
              label: entry,
              fieldname: frappe.scrub(entry),
              onchange: () => this.update_options()
            });
          });
          fields.push(...this.get_voucher_fields());
          me.dialog = new frappe.ui.Dialog({
            title: __("Reconcile the Bank Transaction"),
            fields,
            size: "large",
            primary_action: (values) => this.reconciliation_dialog_primary_action(values)
          });
        }
      });
    }
    get_voucher_fields() {
      return [
        {
          fieldtype: "Check",
          label: "Show Only Exact Amount",
          fieldname: "exact_match",
          onchange: () => this.update_options()
        },
        {
          fieldname: "column_break_5",
          fieldtype: "Column Break"
        },
        {
          fieldtype: "Check",
          label: "Bank Transaction",
          fieldname: "bank_transaction",
          onchange: () => this.update_options()
        },
        {
          fieldtype: "Section Break",
          fieldname: "section_break_1",
          label: __("Select Vouchers to Match"),
          depends_on: "eval:doc.action=='Match Against Voucher'"
        },
        {
          fieldtype: "HTML",
          fieldname: "payment_proposals"
        },
        {
          fieldtype: "HTML",
          fieldname: "no_matching_vouchers",
          options: __('<div class="text-muted text-center">{0}</div>', [
            __("No Matching Vouchers Found")
          ])
        },
        {
          fieldtype: "Section Break",
          fieldname: "details",
          label: "Details",
          depends_on: "eval:doc.action!='Match Against Voucher'"
        },
        {
          fieldname: "reference_number",
          fieldtype: "Data",
          label: "Reference Number",
          mandatory_depends_on: "eval:doc.action=='Create Voucher'"
        },
        {
          default: "Today",
          fieldname: "posting_date",
          fieldtype: "Date",
          label: "Posting Date",
          reqd: 1,
          depends_on: "eval:doc.action=='Create Voucher'"
        },
        {
          fieldname: "reference_date",
          fieldtype: "Date",
          label: "Cheque/Reference Date",
          mandatory_depends_on: "eval:doc.action=='Create Voucher'",
          depends_on: "eval:doc.action=='Create Voucher'",
          reqd: 1
        },
        {
          fieldname: "mode_of_payment",
          fieldtype: "Link",
          label: "Mode of Payment",
          options: "Mode of Payment",
          depends_on: "eval:doc.action=='Create Voucher'"
        },
        {
          fieldname: "edit_in_full_page",
          fieldtype: "Button",
          label: "Edit in Full Page",
          click: () => {
            this.edit_in_full_page();
          },
          depends_on: "eval:doc.action=='Create Voucher'"
        },
        {
          fieldname: "column_break_7",
          fieldtype: "Column Break"
        },
        {
          default: "Bank Entry",
          fieldname: "journal_entry_type",
          fieldtype: "Select",
          label: "Journal Entry Type",
          options: "Journal Entry\nInter Company Journal Entry\nBank Entry\nCash Entry\nCredit Card Entry\nDebit Note\nCredit Note\nContra Entry\nExcise Entry\nWrite Off Entry\nOpening Entry\nDepreciation Entry\nExchange Rate Revaluation\nDeferred Revenue\nDeferred Expense",
          depends_on: "eval:doc.action=='Create Voucher' &&  doc.document_type=='Journal Entry'",
          mandatory_depends_on: "eval:doc.action=='Create Voucher' &&  doc.document_type=='Journal Entry'"
        },
        {
          fieldname: "second_account",
          fieldtype: "Link",
          label: "Account",
          options: "Account",
          depends_on: "eval:doc.action=='Create Voucher' &&  doc.document_type=='Journal Entry'",
          mandatory_depends_on: "eval:doc.action=='Create Voucher' &&  doc.document_type=='Journal Entry'",
          get_query: () => {
            return {
              filters: {
                is_group: 0,
                company: this.company
              }
            };
          }
        },
        {
          fieldname: "party_type",
          fieldtype: "Link",
          label: "Party Type",
          options: "DocType",
          mandatory_depends_on: "eval:doc.action=='Create Voucher' &&  doc.document_type=='Payment Entry'",
          get_query: function() {
            return {
              filters: {
                name: ["in", Object.keys(frappe.boot.party_account_types)]
              }
            };
          }
        },
        {
          fieldname: "party",
          fieldtype: "Dynamic Link",
          label: "Party",
          options: "party_type",
          mandatory_depends_on: "eval:doc.action=='Create Voucher' && doc.document_type=='Payment Entry'"
        },
        {
          fieldname: "bank_account",
          fieldtype: "Link",
          label: "Company Bank Account",
          options: "Bank Account",
          depends_on: "eval:doc.party",
          get_query: () => {
            return {
              filters: {
                is_company_account: 1,
                company: this.company
              }
            };
          }
        },
        {
          fieldname: "project",
          fieldtype: "Link",
          label: "Project",
          options: "Project",
          depends_on: "eval:doc.action=='Create Voucher' && doc.document_type=='Payment Entry'"
        },
        {
          fieldname: "cost_center",
          fieldtype: "Link",
          label: "Cost Center",
          options: "Cost Center",
          depends_on: "eval:doc.action=='Create Voucher' && doc.document_type=='Payment Entry'",
          get_query: () => {
            return {
              filters: {
                is_group: 0,
                company: this.company
              }
            };
          }
        },
        ...this.get_additional_voucher_fields(),
        {
          fieldtype: "Section Break",
          fieldname: "details_section",
          label: "Transaction Details"
        },
        {
          fieldname: "date",
          fieldtype: "Date",
          label: "Date",
          read_only: 1
        },
        {
          fieldname: "deposit",
          fieldtype: "Currency",
          label: "Deposit",
          options: "account_currency",
          read_only: 1
        },
        {
          fieldname: "withdrawal",
          fieldtype: "Currency",
          label: "Withdrawal",
          options: "account_currency",
          read_only: 1
        },
        {
          fieldname: "column_break_17",
          fieldtype: "Column Break",
          read_only: 1
        },
        {
          fieldname: "description",
          fieldtype: "Small Text",
          label: "Description",
          read_only: 1
        },
        {
          fieldname: "allocated_amount",
          fieldtype: "Currency",
          label: "Allocated Amount",
          options: "account_currency",
          read_only: 1
        },
        {
          fieldname: "unallocated_amount",
          fieldtype: "Currency",
          label: "Unallocated Amount",
          options: "account_currency",
          read_only: 1
        },
        {
          fieldname: "account_currency",
          fieldtype: "Link",
          label: "Currency",
          options: "Currency",
          read_only: 1,
          hidden: 1
        }
      ];
    }
    get_additional_voucher_fields() {
      return Object.values(this.get_voucher_types()).flatMap(
        (voucher_type) => voucher_type.get_fields ? voucher_type.get_fields(this) : []
      );
    }
    get_selected_attributes() {
      let selected_attributes = [];
      this.dialog.$wrapper.find(".checkbox input").each((i, col) => {
        if ($(col).is(":checked")) {
          selected_attributes.push($(col).attr("data-fieldname"));
        }
      });
      return selected_attributes;
    }
    update_options() {
      let selected_attributes = this.get_selected_attributes();
      this.get_linked_vouchers(selected_attributes);
    }
    reconciliation_dialog_primary_action(values) {
      if (values.action == "Match Against Voucher")
        this.match(values);
      else if (values.action == "Create Voucher")
        this.create_voucher(values);
      else if (values.action == "Update Bank Transaction")
        this.update_transaction(values);
    }
    match() {
      var selected_map = this.datatable.rowmanager.checkMap;
      let rows = [];
      selected_map.forEach((val, index) => {
        if (val == 1)
          rows.push(this.datatable.datamanager.rows[index]);
      });
      let vouchers = [];
      rows.forEach((x) => {
        vouchers.push({
          payment_doctype: x[2].content,
          payment_name: x[3].content,
          amount: x[5].content
        });
      });
      frappe.call({
        method: "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.reconcile_vouchers",
        args: {
          bank_transaction_name: this.bank_transaction.name,
          vouchers
        },
        callback: (response) => {
          const alert_string = __("Bank Transaction {0} Matched", [this.bank_transaction.name]);
          frappe.show_alert(alert_string);
          this.update_dt_cards(response.message);
          this.dialog.hide();
        }
      });
    }
    create_voucher(values, allow_edit = false) {
      const voucher_type = this.get_voucher_types()[values.document_type];
      if (!voucher_type) {
        frappe.throw(__("Cannot create {0} from a Bank Transaction", [values.document_type]));
      }
      return voucher_type.create(this, values, allow_edit).then((message) => {
        if (allow_edit) {
          const doc = frappe.model.sync(message);
          track_voucher(doc[0].doctype, doc[0].name, this.bank_transaction.name);
          frappe.set_route("Form", doc[0].doctype, doc[0].name);
          return;
        }
        frappe.show_alert(
          __("Bank Transaction {0} added as {1}", [this.bank_transaction.name, values.document_type])
        );
        this.update_dt_cards(message);
        this.dialog.hide();
      });
    }
    update_transaction(values) {
      frappe.call({
        method: "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.update_bank_transaction",
        args: {
          bank_transaction_name: this.bank_transaction.name,
          reference_number: values.reference_number,
          party_type: values.party_type,
          party: values.party
        },
        callback: (response) => {
          const alert_string = __("Bank Transaction {0} updated", [this.bank_transaction.name]);
          frappe.show_alert(alert_string);
          this.update_dt_cards(response.message);
          this.dialog.hide();
        }
      });
    }
    edit_in_full_page() {
      const values = this.dialog.get_values(true);
      return this.create_voucher(values, true);
    }
  };
  var pending_reconciliations = /* @__PURE__ */ new Map();
  var voucher_key = (doctype, docname) => `${doctype}:${docname}`;
  var track_voucher = (doctype, docname, bank_transaction_name) => {
    pending_reconciliations.set(voucher_key(doctype, docname), bank_transaction_name);
  };
  for (const voucher_doctype of Object.keys(erpnext.accounts.bank_reconciliation.voucher_types)) {
    frappe.ui.form.on(voucher_doctype, {
      before_save(frm) {
        frm.__pending_reconciliation_key = voucher_key(frm.doctype, frm.doc.name);
      },
      after_save(frm) {
        const old_key = frm.__pending_reconciliation_key;
        delete frm.__pending_reconciliation_key;
        const new_key = voucher_key(frm.doctype, frm.doc.name);
        if (!old_key || old_key === new_key || !pending_reconciliations.has(old_key))
          return;
        pending_reconciliations.set(new_key, pending_reconciliations.get(old_key));
        pending_reconciliations.delete(old_key);
      },
      on_submit(frm) {
        const key = voucher_key(frm.doctype, frm.doc.name);
        const bank_transaction_name = pending_reconciliations.get(key);
        if (!bank_transaction_name)
          return;
        pending_reconciliations.delete(key);
        frappe.call({
          method: "erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool.reconcile_vouchers",
          args: {
            bank_transaction_name,
            vouchers: [
              {
                payment_doctype: frm.doctype,
                payment_name: frm.doc.name
              }
            ],
            is_new_voucher: true
          },
          callback: (r) => {
            if (r.exc)
              return;
            frappe.show_alert({
              message: __("Bank Transaction {0} Matched", [bank_transaction_name]),
              indicator: "green"
            });
          },
          error: () => {
            frappe.msgprint({
              title: __("Reconciliation Failed"),
              indicator: "red",
              message: __(
                "{0} {1} was submitted but could not be reconciled against Bank Transaction {2}. Match it manually from the Bank Reconciliation Tool.",
                [__(frm.doctype), frm.doc.name, bank_transaction_name]
              )
            });
          }
        });
      }
    });
  }
})();
//# sourceMappingURL=bank-reconciliation-tool.bundle.WS47JJGM.js.map
